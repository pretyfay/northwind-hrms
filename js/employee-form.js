import { 
     createEmployee,
 getDepartments,
 getDesignations,
 getManagerOptions,
 findUserIdByName
} from './db.js';
import {
 validateEmployee,
 hasErrors,
 calculateGross
} from './logic/employee.js';
import { USERS, getCurrentUser, setCurrentUser } from './config.js';

// ELEMENTS

const formEl = document.getElementById('employeeForm');
const alertEl = document.getElementById('alert');
const grossEl = document.getElementById('grossTotal');
const userEl = document.getElementById('userSwitcher');
const deptEl = document.getElementById('departmentId');
const desigEl = document.getElementById('designationId');
const managerEl = document.getElementById('managerId');
const draftBtn = document.getElementById('saveDraft');
const submitBtn = document.getElementById('saveSubmit');
// Which button was pressed decides the starting status.
let chosenStatus = 'Draft';

// READ THE FORM

function readForm() {
 const data = new FormData(formEl);
 return {
 fullName: (data.get('fullName') || '').trim(),
 email: (data.get('email') || '').trim(),
 mobile: (data.get('mobile') || '').trim(),
 dateOfBirth: data.get('dateOfBirth') || '',
 gender: data.get('gender') || '',
 nationality: (data.get('nationality') || '').trim(),
 joiningDate: data.get('joiningDate') || '',
 departmentId: data.get('departmentId') || '',
 designationId: data.get('designationId') || '',
 location: (data.get('location') || '').trim(),
 managerId: data.get('managerId') || '',
 employmentType: data.get('employmentType') || '',
 basicSalary: data.get('basicSalary'),
 housingAllowance: data.get('housingAllowance'),
 transportationAllowance: data.get('transportationAllowance'),
 otherAllowance: data.get('otherAllowance'),
 salaryEffectiveDate: data.get('salaryEffectiveDate') || '',
 status: chosenStatus
 };
}

// LIVE GROSS TOTAL

function updateGross() {
 const gross = calculateGross(readForm());
 grossEl.textContent = gross.toLocaleString('en-US', {
 minimumFractionDigits: 2,
 maximumFractionDigits: 2
 });
}

// ERRORS ON SCREEN

function clearErrors() {
 formEl.querySelectorAll('.err').forEach(function (el) {
 el.textContent = '';
 });
 formEl.querySelectorAll('.is-invalid').forEach(function (el) {
 el.classList.remove('is-invalid');
 });
 alertEl.hidden = true;
}
function showErrors(errors) {
 Object.keys(errors).forEach(function (field) {
 const msgEl = formEl.querySelector('[data-err="' + field + '"]');
 if (msgEl) msgEl.textContent = errors[field];
 const inputEl = formEl.querySelector('[name="' + field + '"]');
 if (inputEl) inputEl.classList.add('is-invalid');
 });
 const first = formEl.querySelector('.is-invalid');
 if (first) first.focus();
 showAlert('error', 'Please fix the highlighted fields.');
}
function showAlert(kind, message) {
 alertEl.className = 'alert alert--' + kind;
 alertEl.textContent = message;
 alertEl.hidden = false;
 window.scrollTo({ top: 0, behavior: 'smooth' });
}
function setBusy(busy) {
 draftBtn.disabled = busy;
 submitBtn.disabled = busy;
 submitBtn.textContent = busy
 ? 'Saving…'
 : 'Save and submit for approval';
}

// SUBMIT

async function handleSubmit(event) {
 event.preventDefault();
 clearErrors();
 const form = readForm();
 const errors = validateEmployee(form);
 if (hasErrors(errors)) {
 showErrors(errors);
 return;
 }
 setBusy(true);
 try {
 const userId = await findUserIdByName(getCurrentUser().name);
 const employee = await createEmployee(form, userId);
 showAlert(
 'success',
 'Employee ' + employee.employee_code + ' created. ' +
 'Returning to the list…'
 );
 setTimeout(function () {
 window.location.href = 'index.html';
 }, 1400);
 } catch (err) {
 setBusy(false);
 showAlert('error', err.message);
 }
}

// LOAD DROPDOWNS

function fillSelect(selectEl, items, labelFn) {
 items.forEach(function (item) {
 const option = document.createElement('option');
 option.value = item.id;
 option.textContent = labelFn ? labelFn(item) : item.name;
 selectEl.appendChild(option);
 });
}
async function loadDropdowns() {
 try {
 fillSelect(deptEl, await getDepartments());
 fillSelect(desigEl, await getDesignations());
 fillSelect(managerEl, await getManagerOptions(), function (m) {
 return m.full_name + ' · ' + m.employee_code;
 });
 } catch (err) {
 showAlert('error', 'Could not load lists: ' + err.message);
 }
}
function loadUserSwitcher() {
 USERS.forEach(function (u, index) {
 const option = document.createElement('option');
 option.value = index;
 option.textContent = u.name + ' · ' + u.role;
 userEl.appendChild(option);
 });
 userEl.addEventListener('change', function () {
 setCurrentUser(userEl.value);
 });
}

// DEFAULTS

function setDefaultDates() {
 const today = new Date().toISOString().slice(0, 10);
 document.getElementById('joiningDate').value = today;
 document.getElementById('salaryEffectiveDate').value = today;
}

// EVENTS

formEl.addEventListener('input', function (event) {
 updateGross();
 if (event.target.classList.contains('is-invalid')) {
 event.target.classList.remove('is-invalid');
 const name = event.target.getAttribute('name');
 const msgEl = formEl.querySelector('[data-err="' + name + '"]');
 if (msgEl) msgEl.textContent = '';
 }
});
draftBtn.addEventListener('click', function () {
 chosenStatus = 'Draft';
});
submitBtn.addEventListener('click', function () {
 chosenStatus = 'Pending Approval';
});
formEl.addEventListener('submit', handleSubmit);

// START

function start() {
 loadUserSwitcher();
 loadDropdowns();
 setDefaultDates();
 updateGross();
}

start();
