const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

function redirectUser(role) {
    if (role === 'admin') {
        window.location.href = '/admin.html';
    } else {
        // Patient, doctor, and caregiver all use the unified dashboard
        window.location.href = '/dashboard.html';
    }
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Login form submitted');

        const email = document.getElementById('login-email')?.value;
        const password = document.getElementById('login-password')?.value;
        const role = document.getElementById('login-role')?.value;

        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password, role })
            });
            console.log('Login response:', res);

            if (res && res.token) {
                localStorage.setItem('token', res.token);
                // Backward compatibility + root level assignment
                const userObj = res.user ? res.user : {
                    id: res._id || res.id,
                    name: res.name,
                    email: res.email,
                    role: res.role,
                    age: res.age,
                    doctorName: res.doctorName
                };
                localStorage.setItem('user', JSON.stringify(userObj));
                redirectUser(userObj.role);
            } else {
                alert(res?.msg || 'Login failed');
            }
        } catch (err) {
            console.error('Login error:', err);
            alert(err.message || 'An error occurred');
        }
    });
}

if (registerForm) {
    // Populate doctors custom dropdown
    const setupDoctorDropdown = async () => {
        try {
            const doctors = await apiFetch('/auth/doctors');
            const doctorInput = document.getElementById('reg-doctor');
            const dropdown = document.getElementById('doctor-dropdown');
            const listItems = document.getElementById('doctor-list-items');
            
            if (!doctorInput || !dropdown || !listItems) return;

            let allDoctors = doctors || [];

            const renderDoctors = (filterText = '') => {
                listItems.innerHTML = '';
                const filtered = allDoctors.filter(doc => doc.name.toLowerCase().includes(filterText.toLowerCase()));
                
                if (filtered.length === 0) {
                    listItems.innerHTML = '<li class="px-4 py-2 text-slate-400">No doctors found</li>';
                    return;
                }

                filtered.forEach(doc => {
                    const li = document.createElement('li');
                    li.className = 'px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors';
                    li.textContent = doc.name;
                    li.addEventListener('mousedown', (e) => {
                        e.preventDefault(); // Prevent blur
                        doctorInput.value = doc.name;
                        dropdown.classList.add('hidden');
                    });
                    listItems.appendChild(li);
                });
            };

            renderDoctors();

            doctorInput.addEventListener('focus', () => {
                dropdown.classList.remove('hidden');
                renderDoctors(doctorInput.value);
            });

            doctorInput.addEventListener('input', (e) => {
                dropdown.classList.remove('hidden');
                renderDoctors(e.target.value);
            });

            // Prevent input blur when interacting with the dropdown (like scrolling)
            dropdown.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            doctorInput.addEventListener('blur', () => {
                dropdown.classList.add('hidden');
            });

        } catch (err) {
            console.error('Failed to fetch doctors', err);
        }
    };
    setupDoctorDropdown();

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Registration form submitted');

        const name = document.getElementById('reg-name')?.value;
        const email = document.getElementById('reg-email')?.value;
        const password = document.getElementById('reg-password')?.value;
        const role = document.getElementById('role-select')?.value;
        const age = document.getElementById('reg-age')?.value;
        const doctorName = document.getElementById('reg-doctor')?.value;

        const data = { name, email, password, role, age, doctorName };
        console.log('Registration data:', data);

        try {
            const res = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            console.log('Registration response:', res);

            if (res && res.token) {
                localStorage.setItem('token', res.token);
                // Backward compatibility + root level assignment
                const userObj = res.user ? res.user : {
                    id: res._id || res.id,
                    name: res.name,
                    email: res.email,
                    role: res.role,
                    age: res.age,
                    doctorName: res.doctorName
                };
                localStorage.setItem('user', JSON.stringify(userObj));
                redirectUser(userObj.role);
            } else {
                alert(res?.msg || 'Registration failed');
            }
        } catch (err) {
            console.error('Registration error:', err);
            alert(err.message || 'An error occurred');
        }
    });
}
