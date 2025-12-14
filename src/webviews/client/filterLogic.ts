export function computeMatches(
  filter: any,
  items: any[],
  fields: any[],
): string[] {
  try {
    const raw = String(filter || "").trim();
    const q = raw.toLowerCase();
    // if no filter return all ids
    if (!q)
      return items.map((it) => String(it && (it.id || (it.raw && it.raw.id))));

    // build field name -> index map
    const fieldIndexByName: Record<string, number> = {};
    try {
      for (let fi = 0; fi < fields.length; fi++) {
        const fld = fields[fi];
        if (!fld) continue;
        if (fld.name) fieldIndexByName[String(fld.name).toLowerCase()] = fi;
        if (fld.id) fieldIndexByName[String(fld.id).toLowerCase()] = fi;
      }
    } catch (e) {}

    // parse qualifiers like name:"some value" or "name with space":"value" or name:token
    const qualifiers: Record<string, string[]> = {};
    // Regex matches: (simple-key OR "quoted-key"):("quoted-val" OR simple-val)
    const qualRe = /(?:(\-?[\w\-]+)|"([^"]+)"):([^\s"]+|"([^"]+)")/g;
    let m;
    let cleaned = raw;
    while ((m = qualRe.exec(raw)) !== null) {
      const name = (m[1] || m[2] || "").toLowerCase();
      // Value is m[3] (full) -> but we want inner if quoted.
      // m[3] captures `"val"` or `val`.
      // Actually my regex above: `([^\s"]+|"([^"]+)")`
      // Group 3 is whole value part.
      // Group 4 is inner quoted value.
      // If group 4 is set, it was quoted.
      // If group 4 is undefined, use group 3.
      const isQuoted = !!m[4];
      const rawVal = m[4] || m[3] || "";

      if (!name) continue;
      // split comma lists for unquoted values, preserve quoted values intact
      const vals: string[] = [];
      try {
        if (isQuoted) {
          // quoted — keep as single value
          vals.push(String(rawVal).toLowerCase());
        } else {
          // unquoted — split on commas for OR semantics
          String(rawVal)
            .split(",")
            .map((x) => String(x || "").trim())
            .filter((x) => x.length > 0)
            .forEach((v) => vals.push(String(v).toLowerCase()));
        }
      } catch (e) {
        vals.push(String(rawVal || "").toLowerCase());
      }
      qualifiers[name] = qualifiers[name] || [];
      qualifiers[name] = qualifiers[name].concat(vals);
      cleaned = cleaned.replace(m[0], " ");
    }

    const freeTokens = cleaned
      .split(/\s+/)
      .map((x) => String(x || "").trim())
      .filter((x) => x.length > 0)
      .map((x) => x.toLowerCase());

    // helper: parse numeric comparator or range
    function parseNumericExpression(v: any) {
      try {
        const rangeRe = /^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/;
        const compRe = /^(<=|>=|<|>|=|==)?\s*(-?\d+(?:\.\d+)?)$/;
        let m = rangeRe.exec(v);
        if (m) return { type: "range", min: Number(m[1]), max: Number(m[2]) };
        m = compRe.exec(v);
        if (m) return { type: "comp", op: m[1] || "=", val: Number(m[2]) };
      } catch (e) {}
      return null;
    }

    // helper: escape regex
    function escRegex(s: any) {
      return String(s || "").replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
    }

    const out: string[] = [];
    for (let ii = 0; ii < items.length; ii++) {
      const it = items[ii];
      // build item text
      let parts: string[] = [];
      try {
        const c =
          it && it.content
            ? it.content
            : (it && it.raw && it.raw.itemContent) || {};
        if (c) {
          if (c.title) parts.push(String(c.title));
          if (c.name) parts.push(String(c.name));
          if (c.number) parts.push(String(c.number));
          if (c.url) parts.push(String(c.url));
        }
        const fv = Array.isArray(it.fieldValues) ? it.fieldValues : [];
        for (let vi = 0; vi < fv.length; vi++) {
          const v = fv[vi];
          if (!v) continue;
          try {
            if (v.type === "single_select") {
              if (v.option && v.option.name) parts.push(String(v.option.name));
            } else if (v.type === "labels" || v.type === "label") {
              (v.labels || []).forEach(
                (L: any) => L && parts.push(String(L.name || L)),
              );
            } else if (v.type === "text") {
              if (v.text) parts.push(String(v.text));
            } else if (v.type === "number") {
              if (v.number !== undefined) parts.push(String(v.number));
            } else if (v.type === "issue" || v.type === "parent_issue") {
              if (v.parent && v.parent.title)
                parts.push(String(v.parent.title));
              if (v.parent && v.parent.number)
                parts.push(String(v.parent.number));
            } else if (v.type === "pull_request") {
              if (v.pullRequests && Array.isArray(v.pullRequests.nodes)) {
                v.pullRequests.nodes.forEach((p: any) => {
                  if (p && p.title) parts.push(String(p.title));
                  if (p && p.number) parts.push(String(p.number));
                });
              }
            } else if (v.type === "milestone") {
              if (v.milestone && v.milestone.title)
                parts.push(String(v.milestone.title));
            } else if (v.type === "iteration") {
              if (v.title) parts.push(String(v.title));
            } else if (v.type === "repository") {
              if (v.repositoryName) parts.push(String(v.repositoryName));
            } else if (v.type === "assignees") {
              if (v.assignees && Array.isArray(v.assignees)) {
                v.assignees.forEach((a: any) => {
                  if (a.login) parts.push(String(a.login));
                  if (a.name) parts.push(String(a.name));
                });
              }
            } else {
              if (v && v.raw) parts.push(JSON.stringify(v.raw));
            }
          } catch (e) {}
        }
      } catch (e) {}
      const txt = parts.join(" \u0000 ").toLowerCase();

      let ok = true;
      // qualifier checks
      for (const qname in qualifiers) {
        if (!qualifiers.hasOwnProperty(qname)) continue;
        const vals = qualifiers[qname] || [];
        // check for negation prefix
        const isNeg = qname && String(qname).startsWith("-");
        const realName = isNeg ? String(qname).slice(1) : qname;
        for (let vi = 0; vi < vals.length; vi++) {
          const val = vals[vi];
          let matched = false;
          try {
            // type: match content typename
            if (realName === "type") {
              const typ = (
                (it &&
                  it.content &&
                  (it.content.__typename || it.content.type)) ||
                (it && it.raw && it.raw.__typename) ||
                (it && it.type) ||
                ""
              )
                .toString()
                .toLowerCase();
              if (typ.indexOf(val) !== -1) matched = true;
            }

            // is: qualifier maps to typical item states
            if (!matched && realName === "is") {
              const state = (
                (it && it.content && it.content.state) ||
                (it && it.state) ||
                (it && it.raw && it.raw.state) ||
                ""
              )
                .toString()
                .toLowerCase();
              if (state.indexOf(val) !== -1) matched = true;
            }

            // repo: qualifier maps to repository name
            if (!matched && realName === "repo") {
              const repoName = (
                (it &&
                  it.content &&
                  it.content.repository &&
                  it.content.repository.nameWithOwner) ||
                (it && it.repository && it.repository.nameWithOwner) ||
                (it &&
                  it.raw &&
                  it.raw.itemContent &&
                  it.raw.itemContent.repository &&
                  it.raw.itemContent.repository.nameWithOwner) ||
                ""
              )
                .toString()
                .toLowerCase();
              if (repoName.indexOf(val) !== -1) matched = true;
            }

            // assignee: qualifier
            if (
              !matched &&
              (realName === "assignee" || realName === "assignees")
            ) {
              const assignees =
                (it &&
                  it.content &&
                  it.content.assignees &&
                  it.content.assignees.nodes) ||
                (it && it.content && Array.isArray(it.content.assignees)
                  ? it.content.assignees
                  : []) ||
                // Try to find in fieldValues
                (
                  it &&
                  Array.isArray(it.fieldValues) &&
                  it.fieldValues.find(
                    (v: any) => v.type === "assignees" || v.assignees,
                  )
                )?.assignees ||
                [];
              const names = (Array.isArray(assignees) ? assignees : [])
                .map((a: any) => String(a.login || a.name || "").toLowerCase())
                .join(" ");
              if (names.includes(val)) matched = true;
            }

            // parent: qualifier maps to parent issue title matching
            if (!matched && realName === "parent") {
              // Check all parent_issue fields
              const fv = Array.isArray(it.fieldValues) ? it.fieldValues : [];
              for (let vi = 0; vi < fv.length; vi++) {
                const v = fv[vi];
                if (v && (v.type === "parent_issue" || v.type === "issue")) {
                  const pTitle = String(
                    (v.parent && v.parent.title) || "",
                  ).toLowerCase();
                  if (pTitle.includes(val)) {
                    matched = true;
                    break;
                  }
                }
              }
            }

            // has:field / no:field presence checks — val is expected to be a field name
            if (!matched && (realName === "has" || realName === "no")) {
              const fieldName = String(val || "").toLowerCase();
              const idx = fieldIndexByName[fieldName];
              if (idx !== undefined && idx !== null) {
                const fv =
                  (it &&
                    Array.isArray(it.fieldValues) &&
                    it.fieldValues[idx]) ||
                  null;
                const hasValue =
                  fv &&
                  (fv.type === "labels"
                    ? fv.labels && fv.labels.length > 0
                    : fv.type === "text"
                      ? String(fv.text || "").length > 0
                      : fv.type === "number"
                        ? fv.number !== undefined && fv.number !== null
                        : fv.type === "assignees"
                          ? fv.assignees && fv.assignees.length > 0
                          : Boolean(
                              fv &&
                              (fv.option ||
                                fv.raw ||
                                fv.parent ||
                                fv.pullRequests),
                            ));
                if (realName === "has") matched = !!hasValue;
                else matched = !hasValue;
              } else {
                // if field not found, fallback to checking top-level text
                matched = txt.indexOf(fieldName) !== -1;
              }
            }

            // field-scoped matching (including numeric comparisons and wildcard)
            const fieldIdx = fieldIndexByName[realName.toLowerCase()];
            if (!matched && fieldIdx !== undefined) {
              const idx = fieldIdx;
              const fv =
                (it && Array.isArray(it.fieldValues) && it.fieldValues[idx]) ||
                null;
              if (fv) {
                // attempt numeric expression parsing
                const numExpr = parseNumericExpression(val);
                if (
                  numExpr &&
                  ((fields[idx] &&
                    String(
                      fields[idx].dataType || fields[idx].type || "",
                    ).toUpperCase() === "NUMBER") ||
                    fv.type === "number")
                ) {
                  // obtain numeric value
                  let numVal = null;
                  try {
                    if (fv.type === "number" && typeof fv.number === "number")
                      numVal = Number(fv.number);
                    else if (fv.raw && fv.raw.value !== undefined)
                      numVal = Number(fv.raw.value);
                    else if (fv.raw && fv.raw.number !== undefined)
                      numVal = Number(fv.raw.number);
                  } catch (e) {}
                  if (numVal !== null && !isNaN(numVal)) {
                    if (numExpr.type === "comp") {
                      const op = numExpr.op || "=";
                      const vnum = Number(numExpr.val);
                      if (op === ">") matched = numVal > vnum;
                      else if (op === ">=") matched = numVal >= vnum;
                      else if (op === "<") matched = numVal < vnum;
                      else if (op === "<=") matched = numVal <= vnum;
                      else matched = numVal === vnum;
                    } else if (numExpr.type === "range") {
                      matched =
                        numVal >= Number(numExpr.min) &&
                        numVal <= Number(numExpr.max);
                    }
                  }
                } else {
                  // string/wildcard matching
                  const oneText = (function (v) {
                    try {
                      if (!v) return "";
                      if (v.type === "single_select")
                        return String(
                          (v.option && v.option.name) || "",
                        ).toLowerCase();
                      if (v.type === "labels" || v.type === "label")
                        return (v.labels || [])
                          .map((L: any) => String((L && (L.name || L)) || ""))
                          .join(" ")
                          .toLowerCase();
                      if (v.type === "assignees")
                        return (v.assignees || [])
                          .map((a: any) => String(a.login || a.name || ""))
                          .join(" ")
                          .toLowerCase();
                      if (v.type === "text")
                        return String(v.text || "").toLowerCase();
                      if (v.type === "number")
                        return String(v.number || "").toLowerCase();
                      if (v.type === "date")
                        return String(v.date || "")
                          .split("T")[0]
                          .toLowerCase();
                      if (v.type === "issue" || v.type === "parent_issue")
                        return String(
                          (v.parent && v.parent.title) || "",
                        ).toLowerCase();
                      if (v.type === "milestone")
                        return String(
                          (v.milestone && v.milestone.title) || "",
                        ).toLowerCase();
                      if (v.type === "iteration")
                        return String(v.title || "").toLowerCase();
                      if (v.type === "repository")
                        return String(v.repositoryName || "").toLowerCase();

                      return (
                        v.pullRequests && Array.isArray(v.pullRequests.nodes)
                          ? v.pullRequests.nodes
                              .map((p: any) =>
                                String(p.title || p.number || ""),
                              )
                              .join(" ")
                          : ""
                      ).toLowerCase();

                      if (v && v.raw)
                        return JSON.stringify(v.raw).toLowerCase();
                    } catch (e) {}
                    return "";
                  })(fv);
                  if (val.indexOf("*") !== -1) {
                    try {
                      const rx = new RegExp(
                        escRegex(val).replace(/\\\*/g, ".*"),
                        "i",
                      );
                      if (rx.test(oneText)) matched = true;
                    } catch (e) {}
                  } else {
                    // Exact match required
                    if (oneText === val) matched = true;
                  }
                }
              }
            }

            // fallback: search the whole item text
            // Skip fallback for structural qualifiers
            const strictQualifiers = [
              "parent",
              "type",
              "is",
              "repo",
              "has",
              "no",
            ];
            if (
              !matched &&
              !strictQualifiers.includes(realName) &&
              fieldIndexByName[realName.toLowerCase()] === undefined
            ) {
              if (val.indexOf("*") !== -1) {
                try {
                  const rx = new RegExp(
                    escRegex(val).replace(/\\\*/g, ".*"),
                    "i",
                  );
                  if (rx.test(txt)) matched = true;
                } catch (e) {}
              } else if (txt.indexOf(val) !== -1) matched = true;
            }
          } catch (e) {}
          if (isNeg) {
            if (matched) {
              ok = false;
              break;
            }
          } else {
            if (!matched) {
              ok = false;
              break;
            }
          }
        }
        if (!ok) break;
      }
      if (!ok) continue;

      // free-text tokens (all must match)
      for (let ti = 0; ti < freeTokens.length; ti++) {
        const tok = freeTokens[ti];
        if (!tok) continue;
        if (tok.indexOf("*") !== -1) {
          try {
            const rx = new RegExp(escRegex(tok).replace(/\\\*/g, ".*"), "i");
            if (!rx.test(txt)) {
              ok = false;
              break;
            }
          } catch (e) {
            ok = false;
            break;
          }
        } else {
          if (txt.indexOf(tok) === -1) {
            ok = false;
            break;
          }
        }
      }
      if (ok) out.push(String(it && (it.id || (it.raw && it.raw.id))));
    }
    return out;
  } catch (e) {
    return items.map((it) => String(it && (it.id || (it.raw && it.raw.id))));
  }
}
