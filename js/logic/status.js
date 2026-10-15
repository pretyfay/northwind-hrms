
// STATUS ENGINE
//
// Every workflow in this system is a set of allowed moves between
// statuses. Instead of scattering "if" checks through the code, all
// of them live in one map here.
//
// This single file satisfies payroll rules 4, 5, 6 and 8 from the
// brief, plus the leave and employee workflows.

export const TRANSITIONS = {
employee: {
'Draft': ['Pending Approval'],
'Pending Approval': ['Approved', 'Rejected'],
'Approved': ['Active'],
'Active': ['Inactive'],
'Inactive': [],
'Rejected': ['Draft']
},
leave_request: {
'Draft': ['Submitted'],
'Submitted': ['Pending Approval', 'Draft'],
'Pending Approval': ['Approved', 'Rejected'],
'Approved': [],
'Rejected': []
},
payroll: {
'Draft': ['Calculated', 'Cancelled'],
'Calculated': ['Pending Approval', 'Draft', 'Cancelled'],
'Pending Approval': ['Approved', 'Calculated', 'Cancelled'],
'Approved': ['Processed', 'Cancelled'],
'Processed': ['Paid'],
'Paid': [],
'Cancelled': []
}
};
// Can this entity move from one status to another?
export function canTransition(entity, from, to) {
const map = TRANSITIONS[entity];
if (!map) return false;
const allowed = map[from];
if (!allowed) return false;
return allowed.indexOf(to) !== -1;
}
// Which statuses can this record move to right now?
export function nextStatuses(entity, from) {
const map = TRANSITIONS[entity];
if (!map) return [];
return map[from] || [];
}
// A record with nowhere left to go is finished.
export function isFinal(entity, status) {
return nextStatuses(entity, status).length === 0;
}
// A readable message when a move is refused.
export function refusalMessage(entity, from, to) {
const allowed = nextStatuses(entity, from);
if (allowed.length === 0) {
return 'This record is ' + from + ' and cannot change.';
}
return 'Cannot move from ' + from + ' to ' + to +
'. Allowed: ' + allowed.join(', ') + '.';
}