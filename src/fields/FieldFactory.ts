import {
  Field,
  GenericField,
  TextField,
  NumberField,
  SingleSelectField,
  DateField,
  IterationField,
  UserField,
  PullRequestField,
  LabelField,
  RepositoryField,
  MilestoneField,
  SubIssuesProgressField,
  ParentIssueField,
} from './Field';

export class FieldFactory {
  static create(meta: any): Field {
    const dt = String(meta?.dataType ?? '').toUpperCase();
    const name = String(meta?.name ?? '');
    switch (dt) {
      case 'NUMBER':
        return new NumberField(meta);
      case 'SINGLE_SELECT':
        return new SingleSelectField(meta);
      case 'DATE':
        return new DateField(meta);
      case 'ITERATION':
        return new IterationField(meta);
      case 'ASSIGNEES':
        return new UserField(meta);
      case 'LINKED_PULL_REQUESTS':
        return new PullRequestField(meta);
      case 'LABELS':
        return new LabelField(meta);
      case 'REPOSITORY':
        return new RepositoryField(meta);
      case 'MILESTONE':
        return new MilestoneField(meta);
      case 'DATE':
      // handled above
      return new DateField(meta);
    case 'TEXT':
    default:
      // Name-based specializations
      if (/^\s*sub-?issues\s+progress\s*$/i.test(name) || /^sub-?issues/i.test(dt)) return new SubIssuesProgressField(meta);
      if (/^\s*parent(\s+issue)?\s*$/i.test(name)) return new ParentIssueField(meta);
      if (dt === 'TEXT') return new TextField(meta);
      return new GenericField(meta);
    }
  }
}

export default FieldFactory;
