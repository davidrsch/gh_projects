export abstract class Field {
  public meta: any;
  constructor(meta: any) {
    this.meta = meta || {};
  }

  get id(): string {
    return this.meta?.id;
  }

  get name(): string {
    return this.meta?.name || '';
  }

  get dataType(): string {
    return this.meta?.dataType || 'TEXT';
  }

  // Parse a raw value from the GraphQL shape into a canonical JS value
  // Default implementation is a no-op that returns the raw value.
  parseValue(raw: any): any {
    // Default: attempt to return common scalar properties or the node itself
    if (!raw) return null;
    if (raw.text !== undefined) return raw.text;
    if (raw.number !== undefined) return raw.number;
    if (raw.date !== undefined) return raw.date;
    if (raw.name !== undefined) return raw.name;
    if (raw.title !== undefined) return raw.title;
    return raw;
  }
}

export class GenericField extends Field {}

export class TextField extends Field {
  parseValue(raw: any): any {
    if (!raw) return '';
    if (typeof raw === 'string') return raw;
    if (raw.text !== undefined) return String(raw.text ?? '');
    return String(raw);
  }
}

export class NumberField extends Field {
  parseValue(raw: any): any {
    if (!raw) return null;
    if (typeof raw === 'number') return raw;
    if (raw.number !== undefined) {
      const n = typeof raw.number === 'number' ? raw.number : Number(raw.number);
      return Number.isNaN(n) ? null : n;
    }
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
}

export class SingleSelectField extends Field {
  parseValue(raw: any): any {
    // Expect either { id, name, color } or a simple name
    if (!raw) return null;
    // The GraphQL single-select value shape may expose optionId and name
    if (raw.optionId || raw.name) {
      const id = raw.optionId ?? null;
      let name = raw.name ?? null;
      let color = null;
      // If field meta includes options, try to resolve color/name
      if (id && Array.isArray(this.meta?.options)) {
        const found = this.meta.options.find((o: any) => String(o.id) === String(id));
        if (found) {
          name = name || found.name;
          color = found.color || null;
        }
      }
      return { id, name, color };
    }
    if (typeof raw === 'string') return { id: null, name: raw, color: null };
    if (raw.id || raw.name) return { id: raw.id ?? null, name: raw.name ?? null, color: raw.color ?? null };
    return null;
  }
}

export class DateField extends Field {
  parseValue(raw: any): any {
    if (!raw) return null;
    if (raw.date !== undefined) return raw.date;
    return null;
  }
}

export class IterationField extends Field {
  parseValue(raw: any): any {
    if (!raw) return null;
    return raw.title ?? raw.id ?? null;
  }
}

export class UserField extends Field {
  parseValue(raw: any): any {
    if (!raw) return [];
    const nodes = raw.users?.nodes ?? [];
    return (nodes ?? []).map((u: any) => ({ login: u?.login, name: u?.name ?? null, avatarUrl: u?.avatarUrl ?? null, url: u?.url ?? null }));
  }
}

export class PullRequestField extends Field {
  parseValue(raw: any): any {
    if (!raw) return [];
    const nodes = raw.pullRequests?.nodes ?? [];
    return (nodes ?? []).map((p: any) => ({ number: p?.number ?? null, title: p?.title ?? null, url: p?.url ?? null, repo: p?.repository?.nameWithOwner ?? null, state: p?.state ?? null, merged: typeof p?.merged === 'boolean' ? p.merged : null, ownerAvatar: p?.repository?.owner?.avatarUrl ?? null }));
  }
}

export class LabelField extends Field {
  parseValue(raw: any): any {
    if (!raw) return [];
    const nodes = raw.labels?.nodes ?? [];
    return (nodes ?? []).map((l: any) => ({ id: l?.id ?? null, name: l?.name ?? null, color: l?.color ?? null }));
  }
}

export class RepositoryField extends Field {
  parseValue(raw: any): any {
    if (!raw) return null;
    return raw.repository ? { nameWithOwner: raw.repository.nameWithOwner ?? null, url: raw.repository.url ?? null, ownerAvatar: raw.repository.owner?.avatarUrl ?? null } : null;
  }
}

export class MilestoneField extends Field {
  parseValue(raw: any): any {
    if (!raw) return null;
    const m = raw.milestone ?? raw;
    if (!m) return null;
    return {
      id: m.id ?? null,
      title: m.title ?? null,
      dueOn: m.dueOn ?? null,
      state: m.state ?? null,
      number: m.number ?? null,
      url: m.url ?? null,
    };
  }
}

export class SubIssuesProgressField extends Field {
  parseValue(raw: any): any {
    if (!raw) return null;
    // raw may already be injected as { total, completed, percent }
    if (raw.total !== undefined && raw.completed !== undefined) {
      return { total: Number(raw.total ?? 0), completed: Number(raw.completed ?? 0), percent: Number(raw.percent ?? 0) };
    }
    // otherwise attempt to read from nested shapes
    const ss = raw.subIssuesSummary ?? raw;
    if (ss && ss.total !== undefined) {
      return { total: Number(ss.total ?? 0), completed: Number(ss.completed ?? 0), percent: Number(ss.percentCompleted ?? ss.percent ?? 0) };
    }
    return null;
  }
}

export class ParentIssueField extends Field {
  parseValue(raw: any): any {
    if (!raw) return null;
    // raw may be injected { number, title, url, state }
    if (raw.number !== undefined || raw.title !== undefined) {
      return { number: raw.number ?? null, title: raw.title ?? null, url: raw.url ?? null, state: raw.state ?? null };
    }
    const p = raw.parent ?? raw;
    if (p && (p.number !== undefined || p.title !== undefined)) {
      return { number: p.number ?? null, title: p.title ?? null, url: p.url ?? null, state: p.state ?? null };
    }
    return null;
  }
}
