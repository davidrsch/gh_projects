/**
 * @jest-environment jsdom
 */
import { parseSortByFields, sortItems, compareFieldValues } from '../../../../src/webviews/client/utils/tableSorting';
import { ProjectV2FieldType } from '../../../../src/lib/types';

describe('tableSorting', () => {
    describe('parseSortByFields', () => {
        test('returns null for empty sortByFields', () => {
            expect(parseSortByFields(null)).toBeNull();
            expect(parseSortByFields({ nodes: [] })).toBeNull();
        });

        test('parses primary sort', () => {
            const sortByFields = {
                nodes: [
                    {
                        direction: 'ASC',
                        field: { id: 'field1', name: 'Title' }
                    }
                ]
            };

            const result = parseSortByFields(sortByFields);
            expect(result).toEqual({
                fieldId: 'field1',
                direction: 'ASC'
            });
        });

        test('parses primary and secondary sort', () => {
            const sortByFields = {
                nodes: [
                    {
                        direction: 'DESC',
                        field: { id: 'field1', name: 'Priority' }
                    },
                    {
                        direction: 'ASC',
                        field: { id: 'field2', name: 'Title' }
                    }
                ]
            };

            const result = parseSortByFields(sortByFields);
            expect(result).toEqual({
                fieldId: 'field1',
                direction: 'DESC',
                secondary: {
                    fieldId: 'field2',
                    direction: 'ASC'
                }
            });
        });
    });

    describe('sortItems', () => {
        const createField = (id: string, name: string, dataType: string, options?: any[]) => ({
            id,
            name,
            dataType: dataType as ProjectV2FieldType,
            options
        });

        describe('text fields', () => {
            test('sorts text fields alphabetically ascending', () => {
                const fields = [createField('f1', 'Title', 'TEXT')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', type: 'text', text: 'Zebra' }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', type: 'text', text: 'Apple' }] },
                    { id: '3', fieldValues: [{ fieldId: 'f1', type: 'text', text: 'Mango' }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result[0].id).toBe('2'); // Apple
                expect(result[1].id).toBe('3'); // Mango
                expect(result[2].id).toBe('1'); // Zebra
            });

            test('sorts text fields alphabetically descending', () => {
                const fields = [createField('f1', 'Title', 'TEXT')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', type: 'text', text: 'Apple' }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', type: 'text', text: 'Zebra' }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'DESC' });

                expect(result[0].id).toBe('2'); // Zebra
                expect(result[1].id).toBe('1'); // Apple
            });

            test('handles null values in text sorting', () => {
                const fields = [createField('f1', 'Title', 'TEXT')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', type: 'text', text: 'Apple' }] },
                    { id: '2', fieldValues: [] }, // No value
                    { id: '3', fieldValues: [{ fieldId: 'f1', type: 'text', text: 'Banana' }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                // Null values should come last in ascending
                expect(result[0].id).toBe('1'); // Apple
                expect(result[1].id).toBe('3'); // Banana
                expect(result[2].id).toBe('2'); // null
            });
        });

        describe('title fields', () => {
            test('sorts title fields by content string', () => {
                const fields = [createField('f1', 'Title', 'TITLE')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', type: 'title', title: { content: 'Zebra' } }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', type: 'title', title: { content: 'Apple' } }] },
                    { id: '3', fieldValues: [{ fieldId: 'f1', type: 'title', title: { content: 'Mango' } }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '3', '1']); // Apple, Mango, Zebra
            });

            test('sorts runtime-shaped TITLE values (raw + content)', () => {
                const fields = [createField('f1', 'Title', 'TITLE')];

                const makeItem = (id: string, titleText: string) => {
                    const itemContent = { title: titleText, number: Number(id) } as any;
                    const rawNode = { text: titleText, itemContent } as any;
                    return {
                        id,
                        content: itemContent,
                        fieldValues: [
                            {
                                fieldId: 'f1',
                                type: 'title',
                                title: { raw: rawNode, content: itemContent },
                                raw: rawNode,
                                content: itemContent,
                            },
                        ],
                    };
                };

                const items = [
                    makeItem('1', 'Zebra'),
                    makeItem('2', 'Apple'),
                    makeItem('3', 'Mango'),
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map((i) => i.id)).toEqual(['2', '3', '1']); // Apple, Mango, Zebra
            });
        });

        describe('number fields', () => {
            test('sorts number fields numerically', () => {
                const fields = [createField('f1', 'Points', 'NUMBER')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', type: 'number', number: 100 }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', type: 'number', number: 5 }] },
                    { id: '3', fieldValues: [{ fieldId: 'f1', type: 'number', number: 50 }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result[0].id).toBe('2'); // 5
                expect(result[1].id).toBe('3'); // 50
                expect(result[2].id).toBe('1'); // 100
            });

            test('handles negative numbers', () => {
                const fields = [createField('f1', 'Points', 'NUMBER')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', type: 'number', number: -10 }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', type: 'number', number: 0 }] },
                    { id: '3', fieldValues: [{ fieldId: 'f1', type: 'number', number: 5 }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result[0].id).toBe('1'); // -10
                expect(result[1].id).toBe('2'); // 0
                expect(result[2].id).toBe('3'); // 5
            });
        });

        describe('date fields', () => {
            test('sorts date fields chronologically', () => {
                const fields = [createField('f1', 'DueDate', 'DATE')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', type: 'date', date: '2024-12-31' }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', type: 'date', date: '2024-01-01' }] },
                    { id: '3', fieldValues: [{ fieldId: 'f1', type: 'date', date: '2024-06-15' }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result[0].id).toBe('2'); // 2024-01-01
                expect(result[1].id).toBe('3'); // 2024-06-15
                expect(result[2].id).toBe('1'); // 2024-12-31
            });
        });

        describe('single_select fields', () => {
            test('sorts by option order when options available', () => {
                const fields = [createField('f1', 'Status', 'SINGLE_SELECT', [
                    { id: 'opt1', name: 'Todo', color: 'RED' },
                    { id: 'opt2', name: 'In Progress', color: 'YELLOW' },
                    { id: 'opt3', name: 'Done', color: 'GREEN' }
                ])];

                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', type: 'single_select', option: { id: 'opt3', name: 'Done' } }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', type: 'single_select', option: { id: 'opt1', name: 'Todo' } }] },
                    { id: '3', fieldValues: [{ fieldId: 'f1', type: 'single_select', option: { id: 'opt2', name: 'In Progress' } }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result[0].id).toBe('2'); // Todo (index 0)
                expect(result[1].id).toBe('3'); // In Progress (index 1)
                expect(result[2].id).toBe('1'); // Done (index 2)
            });

            test('sorts by name when no options array', () => {
                const fields = [createField('f1', 'Status', 'SINGLE_SELECT')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', type: 'single_select', option: { name: 'Zebra' } }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', type: 'single_select', option: { name: 'Apple' } }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result[0].id).toBe('2'); // Apple
                expect(result[1].id).toBe('1'); // Zebra
            });
        });

        describe('iteration fields', () => {
            test('sorts by start date', () => {
                const fields = [createField('f1', 'Sprint', 'ITERATION')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', type: 'iteration', startDate: '2024-03-01', title: 'Sprint 3' }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', type: 'iteration', startDate: '2024-01-01', title: 'Sprint 1' }] },
                    { id: '3', fieldValues: [{ fieldId: 'f1', type: 'iteration', startDate: '2024-02-01', title: 'Sprint 2' }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result[0].id).toBe('2'); // Sprint 1
                expect(result[1].id).toBe('3'); // Sprint 2
                expect(result[2].id).toBe('1'); // Sprint 3
            });
        });

        describe('label fields', () => {
            test('sorts by first label name', () => {
                const fields = [createField('f1', 'Labels', 'LABELS')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', labels: [{ name: 'Zebra' }] }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', labels: [{ name: 'Apple' }] }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '1']);
            });
        });

        describe('assignees fields', () => {
            test('sorts by first assignee login', () => {
                const fields = [createField('f1', 'Assignees', 'ASSIGNEES')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', assignees: [{ login: 'zeta' }] }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', assignees: [{ login: 'alpha' }] }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '1']);
            });
        });

        describe('repository fields', () => {
            test('sorts by repository nameWithOwner', () => {
                const fields = [createField('f1', 'Repository', 'REPOSITORY')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', repository: { nameWithOwner: 'z-org/z-repo' } }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', repository: { nameWithOwner: 'a-org/a-repo' } }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '1']);
            });
        });

        describe('milestone fields', () => {
            test('sorts by due date or title', () => {
                const fields = [createField('f1', 'Milestone', 'MILESTONE')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', milestone: { title: 'v2', dueOn: '2024-12-31' } }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', milestone: { title: 'v1', dueOn: '2024-01-01' } }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '1']);
            });
        });

        describe('issue type fields', () => {
            test('sorts by text or option name', () => {
                const fields = [createField('f1', 'Issue Type', 'ISSUE_TYPE')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', text: 'Z-bug' }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', text: 'A-task' }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '1']);
            });
        });

        describe('parent issue fields', () => {
            test('sorts by parent title', () => {
                const fields = [createField('f1', 'Parent', 'PARENT_ISSUE')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', parent: { title: 'Z-parent', number: 2 } }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', parent: { title: 'A-parent', number: 1 } }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '1']);
            });
        });

        describe('linked pull requests fields', () => {
            test('sorts by first pull request number', () => {
                const fields = [createField('f1', 'Linked PRs', 'LINKED_PULL_REQUESTS')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', pullRequests: [{ number: 10 }] }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', pullRequests: [{ number: 2 }] }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '1']);
            });
        });

        describe('reviewers fields', () => {
            test('sorts by first reviewer login/name', () => {
                const fields = [createField('f1', 'Reviewers', 'REVIEWERS')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', reviewers: [{ login: 'zeta' }] }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', reviewers: [{ login: 'alpha' }] }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '1']);
            });
        });

        describe('sub issues progress fields', () => {
            test('sorts by percent completed', () => {
                const fields = [createField('f1', 'Progress', 'SUB_ISSUES_PROGRESS')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', total: 10, done: 8, percent: 80 }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', total: 10, done: 2, percent: 20 }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '1']);
            });
        });

        describe('tracked by / tracks fields', () => {
            test('sorts TRACKED_BY by first issue title', () => {
                const fields = [createField('f1', 'Tracked by', 'TRACKED_BY')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', issues: [{ title: 'Z-issue', number: 2 }] }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', issues: [{ title: 'A-issue', number: 1 }] }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '1']);
            });

            test('sorts TRACKS by first issue title', () => {
                const fields = [createField('f1', 'Tracks', 'TRACKS')];
                const items = [
                    { id: '1', fieldValues: [{ fieldId: 'f1', issues: [{ title: 'Z-track', number: 2 }] }] },
                    { id: '2', fieldValues: [{ fieldId: 'f1', issues: [{ title: 'A-track', number: 1 }] }] }
                ];

                const result = sortItems(items, fields, { fieldId: 'f1', direction: 'ASC' });

                expect(result.map(i => i.id)).toEqual(['2', '1']);
            });
        });

        describe('secondary sorting', () => {
            test('uses secondary sort when primary values are equal', () => {
                const fields = [
                    createField('f1', 'Priority', 'SINGLE_SELECT', [
                        { id: 'high', name: 'High', color: 'RED' },
                        { id: 'low', name: 'Low', color: 'GREEN' }
                    ]),
                    createField('f2', 'Title', 'TEXT')
                ];

                const items = [
                    {
                        id: '1', fieldValues: [
                            { fieldId: 'f1', option: { id: 'high', name: 'High' } },
                            { fieldId: 'f2', text: 'Zebra' }
                        ]
                    },
                    {
                        id: '2', fieldValues: [
                            { fieldId: 'f1', option: { id: 'high', name: 'High' } },
                            { fieldId: 'f2', text: 'Apple' }
                        ]
                    },
                    {
                        id: '3', fieldValues: [
                            { fieldId: 'f1', option: { id: 'low', name: 'Low' } },
                            { fieldId: 'f2', text: 'Banana' }
                        ]
                    }
                ];

                const result = sortItems(items, fields, {
                    fieldId: 'f1',
                    direction: 'ASC',
                    secondary: { fieldId: 'f2', direction: 'ASC' }
                });

                expect(result[0].id).toBe('2'); // High, Apple
                expect(result[1].id).toBe('1'); // High, Zebra
                expect(result[2].id).toBe('3'); // Low, Banana
            });
        });

        test('returns original array if sort config is null', () => {
            const fields = [createField('f1', 'Title', 'TEXT')];
            const items = [
                { id: '1', fieldValues: [] },
                { id: '2', fieldValues: [] }
            ];

            const result = sortItems(items, fields, null as any);
            expect(result).toEqual(items);
        });

        test('returns original array if field not found', () => {
            const fields = [createField('f1', 'Title', 'TEXT')];
            const items = [
                { id: '1', fieldValues: [] },
                { id: '2', fieldValues: [] }
            ];

            const result = sortItems(items, fields, { fieldId: 'nonexistent', direction: 'ASC' });
            expect(result).toEqual(items);
        });
    });

    describe('compareFieldValues', () => {
        const field = { id: 'f1', name: 'Test', dataType: 'TEXT' as ProjectV2FieldType };

        test('handles null values correctly', () => {
            const a = { fieldValues: [] };
            const b = { fieldValues: [] };

            expect(compareFieldValues(a, b, field, 'ASC')).toBe(0);
        });

        test('null values sort last in ascending', () => {
            const a = { fieldValues: [{ fieldId: 'f1', text: 'value' }] };
            const b = { fieldValues: [] };

            expect(compareFieldValues(a, b, field, 'ASC')).toBeLessThan(0);
        });

        test('null values sort first in descending', () => {
            const a = { fieldValues: [{ fieldId: 'f1', text: 'value' }] };
            const b = { fieldValues: [] };

            expect(compareFieldValues(a, b, field, 'DESC')).toBeGreaterThan(0);
        });
    });
});
