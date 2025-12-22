export class GroupDataService {
  public static groupItems(items: any[], field: any): any[] {
    // Normalize options: Single Select uses .options, Iteration uses .configuration.iterations
    let options: any[] = [];
    const dType = (field.dataType || "").toLowerCase();
    if (dType === "single_select") {
      options = field.options || [];
    } else if (dType === "iteration") {
      options = (field.configuration && field.configuration.iterations) || [];
    }
    // If we have explicit options (single select/iteration), use them to group.
    if (options && options.length > 0) {
      const groups: any[] = options.map((opt: any) => ({
        option: opt,
        items: [],
      }));
      const unassigned: any[] = [];

      items.forEach((item, index) => {
        const fv = item.fieldValues.find(
          (v: any) =>
            String(v.fieldId) === String(field.id) ||
            v.fieldName === field.name,
        );
        let placed = false;

        if (fv) {
          // Match logic
          let matchId: string | null = null;
          let matchName: string | null = null;

          if (dType === "single_select") {
            matchId = fv.optionId || (fv.option && fv.option.id);
            matchName = fv.name || (fv.option && fv.option.name);
          } else if (dType === "iteration") {
            matchId =
              fv.iterationId || (fv.iteration && fv.iteration.id) || fv.id;
            matchName = fv.title || (fv.iteration && fv.iteration.title);
          }

          if (matchId || matchName) {
            const group = groups.find(
              (g: any) =>
                (matchId && String(g.option.id) === String(matchId)) ||
                (matchName &&
                  (String(g.option.name) === String(matchName) ||
                    String(g.option.title) === String(matchName))),
            );
            if (group) {
              group.items.push({ item, index });
              placed = true;
            }
          }
        }

        if (!placed) {
          unassigned.push({ item, index });
        }
      });

      if (unassigned.length > 0) {
        groups.push({
          option: { name: "Unassigned", title: "Unassigned", color: "GRAY" },
          items: unassigned,
        });
      }

      

      return groups.filter((g: any) => g.items.length > 0);
    }

    // Fallback grouping: build groups based on actual item values (useful for assignees, repository, date, number, etc.)
    const map = new Map<string, { option: any; items: any[] }>();
    const unassignedFallback: any[] = [];

    items.forEach((item, index) => {
      const fv = item.fieldValues.find(
        (v: any) =>
          String(v.fieldId) === String(field.id) || v.fieldName === field.name,
      );
      let val: any = null;
      if (fv) {
        // Text/title/number/date straightforward
        if (fv.text !== undefined) val = fv.text;
        else if (fv.title !== undefined) val = fv.title;
        else if (fv.number !== undefined) val = fv.number;
        else if (fv.date !== undefined) val = fv.date;
        // single_select / option
        else if (fv.option)
          val = fv.option.name || fv.option.title || fv.option.id;
        // iteration
        else if (fv.iteration) val = fv.iteration.title || fv.iteration.id;
        // parent_issue - try parent/parentIssue/issue/item/value/raw
        else if (
          fv.parent ||
          fv.parentIssue ||
          fv.issue ||
          fv.item ||
          fv.value
        ) {
          const p =
            fv.parent || fv.parentIssue || fv.issue || fv.item || fv.value;
          if (p) {
            // Prefer number, then id, then url, then title
            val =
              p.number ||
              p.id ||
              (p.raw && (p.raw.number || p.raw.id)) ||
              p.url ||
              p.title ||
              p.name ||
              null;
          }
        }
        // assignees
        else if (fv.assignees)
          val = Array.isArray(fv.assignees)
            ? fv.assignees.map((a: any) => a.login || a.name).join(", ")
            : fv.assignees;
        // repository
        else if (fv.repository)
          val =
            fv.repository.nameWithOwner ||
            fv.repository.name ||
            fv.repository.full_name ||
            fv.repository.id;
        // milestone
        else if (fv.milestone)
          val = fv.milestone.title || fv.milestone.id || fv.milestone.name;
        else val = fv.value !== undefined ? fv.value : null;
      }

      if (val === null || val === undefined || val === "") {
        unassignedFallback.push({ item, index });
        return;
      }

      // Normalize string values for grouping to avoid excessive fragmentation
      let displayVal: any = val;
      if (typeof val === "string") {
        // Trim and use first line to represent multi-line text fields
        try {
          displayVal = String(val).trim();
          const lines = displayVal.split(/\r?\n/);
          if (lines.length > 0) displayVal = lines[0].trim();
          // Limit length for display/key purposes
          if (displayVal.length > 120) displayVal = displayVal.slice(0, 120);
        } catch (e) {}
      }

      const key = String(typeof displayVal === "string" ? displayVal.toLowerCase() : displayVal);
      if (!map.has(key)) {
        map.set(key, { option: { id: key, name: String(displayVal), title: String(displayVal) }, items: [] });
      }
      map.get(key)!.items.push({ item, index });
    });

    const groupsArr = Array.from(map.values());
    if (unassignedFallback.length > 0) {
      groupsArr.push({
        option: { name: "Unassigned", title: "Unassigned", color: "GRAY" },
        items: unassignedFallback,
      });
    }
    
    return groupsArr;
  }
}
