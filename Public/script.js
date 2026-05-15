// ===== COMMON FUNCTIONS FOR ALL PAGES =====

// Load profile data
async function loadProfileData() {
    try {
        const response = await fetch('/profileData');
        const profile = await response.json();
        
        // Update all profile elements
        const elements = {
            'email': profile.email,
            'userEmail': profile.email,
            'plan': profile.plan || 'No Plan Selected',
            'userPlan': profile.plan || 'No Plan Selected',
            'referralLink': profile.referral || '',
            'userReferral': profile.referral || '',
            'withdrawalLimit': profile.withdrawalLimit || 'Not set',
            'userWithdrawal': profile.withdrawalLimit || 'Not set',
            'amount': profile.amount || '0',
            'userAmount': profile.amount || '0',
            'adminMsg': profile.withdrawalMessage || '',
            'withdrawalStatus': profile.withdrawalRequested ? '⏳ Pending' : (parseFloat(profile.amount || 0) > 0 ? '✅ Ready' : 'No Balance')
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (element.tagName === 'INPUT') {
                    element.value = value;
                } else {
                    element.textContent = value;
                }
            }
        });
        
        // Update withdrawal info if elements exist
        if (document.getElementById('withdrawalMethod') && profile.withdrawalMethod) {
            document.getElementById('withdrawalMethod').value = profile.withdrawalMethod;
        }
        if (document.getElementById('withdrawalAccount') && profile.withdrawalAccount) {
            document.getElementById('withdrawalAccount').value = profile.withdrawalAccount;
        }
        if (document.getElementById('accountHolderName') && profile.accountHolderName) {
            document.getElementById('accountHolderName').value = profile.accountHolderName;
        }
        
        return profile;
    } catch (error) {
        console.error('Error loading profile:', error);
        return null;
    }
}

// Show message function
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        
        if (type === 'success') {
            element.style.color = '#2ecc71';
            element.style.background = '#d4edda';
            element.style.border = '1px solid #c3e6cb';
        } else if (type === 'error') {
            element.style.color = '#e74c3c';
            element.style.background = '#f8d7da';
            element.style.border = '1px solid #f5c6cb';
        } else {
            element.style.color = '#3498db';
            element.style.background = '#d1ecf1';
            element.style.border = '1px solid #bee5eb';
        }
        
        element.style.padding = '10px';
        element.style.borderRadius = '5px';
        element.style.marginTop = '10px';
        
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

// Logout function
function logout() {
    fetch('/logout')
        .then(() => {
            window.location.href = '/login.html';
        })
        .catch(error => {
            console.error('Logout error:', error);
        });
}

// ===== PROFILE PAGE FUNCTIONS =====
if (window.location.pathname.includes('profile.html')) {
    document.addEventListener('DOMContentLoaded', async function() {
        // Load profile data
        await loadProfileData();
        
        // Load DEPOSIT methods (company accounts)
        await loadDepositMethods();
        
        // Load WITHDRAWAL methods (user's personal info)
        await loadWithdrawalMethods();
        
        // Save Withdrawal Info Button
        const saveWithdrawalBtn = document.getElementById('saveWithdrawalBtn');
        if (saveWithdrawalBtn) {
            saveWithdrawalBtn.addEventListener('click', saveWithdrawalInfo);
        }
        
        // Request Withdrawal Button
        const withdrawBtn = document.getElementById('withdrawBtn');
        if (withdrawBtn) {
            withdrawBtn.addEventListener('click', requestWithdrawal);
        }
        
        // Delete Account Button
        const deleteBtn = document.getElementById('deleteAccountBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', deleteAccount);
        }
        
        // Initialize upload system
        initializeUploadSystem();
        
        // Load granted videos
        try {
            const response = await fetch('/profileData');
            const profile = await response.json();
            
            const videoContainer = document.getElementById('videoContainer');
            if (videoContainer && profile.videos && profile.videos.length > 0) {
                videoContainer.innerHTML = '';
                profile.videos.forEach((videoUrl, index) => {
                    const videoDiv = document.createElement('div');
                    videoDiv.style.marginBottom = '20px';
                    videoDiv.innerHTML = `
                        <h4>Video ${index + 1}</h4>
                        <p><a href="${videoUrl}" target="_blank">${videoUrl}</a></p>
                        <button class="mark-watched-btn" data-index="${index}" data-url="${videoUrl}">Mark as Watched</button>
                    `;
                    videoContainer.appendChild(videoDiv);
                });
                
                // Add event listeners to mark watched buttons
                document.querySelectorAll('.mark-watched-btn').forEach(btn => {
                    btn.addEventListener('click', async function() {
                        const videoIndex = this.getAttribute('data-index');
                        const videoUrl = this.getAttribute('data-url');
                        
                        try {
                            const response = await fetch('/markVideoWatched', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ videoIndex, videoUrl })
                            });
                            
                            const result = await response.json();
                            if (result.success) {
                                alert(`✅ Video marked as watched! You earned ${result.earnings} PKR`);
                                location.reload();
                            } else {
                                alert('❌ ' + result.message);
                            }
                        } catch (error) {
                            console.error('Error marking video as watched:', error);
                            alert('Error marking video as watched');
                        }
                    });
                });
            } else if (videoContainer) {
                videoContainer.innerHTML = '<p>No videos granted yet.</p>';
            }
        } catch (error) {
            console.error('Error loading videos:', error);
        }
    });
}

// Load DEPOSIT methods (Company accounts for users to deposit to)
async function loadDepositMethods() {
    try {
        const response = await fetch('/getDepositMethods');
        const methods = await response.json();
        
        const depositContainer = document.getElementById('depositMethods');
        if (depositContainer) {
            if (methods.length === 0) {
                depositContainer.innerHTML = '<p class="no-methods">No deposit methods available yet. Admin will add soon.</p>';
                return;
            }
            
            depositContainer.innerHTML = '<h4>💳 Company Deposit Accounts:</h4>';
            methods.forEach(method => {
                const methodDiv = document.createElement('div');
                methodDiv.className = 'deposit-method';
                methodDiv.innerHTML = `
                    <div class="deposit-card">
                        <h5>${method.name}</h5>
                        <p><strong>Account Number:</strong> <span class="account-number">${method.number}</span></p>
                        <p class="deposit-note"><em>Send payment to this account and contact admin with proof</em></p>
                    </div>
                `;
                depositContainer.appendChild(methodDiv);
            });
        }
    } catch (error) {
        console.error('Error loading deposit methods:', error);
    }
}

// Load WITHDRAWAL methods dropdown
async function loadWithdrawalMethods() {
    try {
        // Fixed withdrawal methods users can choose from
        const withdrawalMethods = [
            { name: "Easypaisa", code: "easypaisa" },
            { name: "JazzCash", code: "jazzcash" },
            { name: "Bank Transfer", code: "bank" },
            { name: "Other", code: "other" }
        ];
        
        const withdrawalMethodSelect = document.getElementById('withdrawalMethod');
        if (withdrawalMethodSelect) {
            withdrawalMethodSelect.innerHTML = '<option value="">Select Withdrawal Method</option>';
            
            withdrawalMethods.forEach(method => {
                const option = document.createElement('option');
                option.value = method.name;
                option.textContent = method.name;
                option.setAttribute('data-code', method.code);
                withdrawalMethodSelect.appendChild(option);
            });
            
            // Load saved withdrawal info if exists
            const profile = await loadProfileData();
            if (profile.withdrawalMethod) {
                withdrawalMethodSelect.value = profile.withdrawalMethod;
            }
        }
        
        // Load saved withdrawal account and name
        const profile = await loadProfileData();
        if (profile.withdrawalAccount) {
            document.getElementById('withdrawalAccount').value = profile.withdrawalAccount;
        }
        if (profile.accountHolderName) {
            document.getElementById('accountHolderName').value = profile.accountHolderName;
        }
        
        // Show saved withdrawal info
        if (profile.withdrawalMethod && profile.withdrawalAccount) {
            const savedInfoDiv = document.getElementById('savedWithdrawalInfo');
            if (savedInfoDiv) {
                savedInfoDiv.style.display = 'block';
                document.getElementById('savedWithdrawalMethod').textContent = profile.withdrawalMethod;
                document.getElementById('savedWithdrawalAccount').textContent = profile.withdrawalAccount;
                document.getElementById('savedAccountHolder').textContent = profile.accountHolderName;
            }
        }
        
    } catch (error) {
        console.error('Error loading withdrawal methods:', error);
    }
}

// Save WITHDRAWAL Information
async function saveWithdrawalInfo() {
    const withdrawalMethod = document.getElementById('withdrawalMethod').value;
    const withdrawalAccount = document.getElementById('withdrawalAccount').value;
    const accountHolderName = document.getElementById('accountHolderName').value;
    const statusDiv = document.getElementById('withdrawalStatusMsg');
    
    if (!withdrawalMethod || !withdrawalMethod.trim()) {
        statusDiv.innerHTML = '❌ Please select a withdrawal method';
        statusDiv.className = 'payment-status error';
        statusDiv.style.display = 'block';
        return;
    }
    
    if (!withdrawalAccount || withdrawalAccount.trim().length < 10) {
        statusDiv.innerHTML = '❌ Please enter a valid account number (minimum 10 digits)';
        statusDiv.className = 'payment-status error';
        statusDiv.style.display = 'block';
        return;
    }
    
    if (!accountHolderName || !accountHolderName.trim()) {
        statusDiv.innerHTML = '❌ Please enter account holder name';
        statusDiv.className = 'payment-status error';
        statusDiv.style.display = 'block';
        return;
    }
    
    const saveWithdrawalBtn = document.getElementById('saveWithdrawalBtn');
    const originalText = saveWithdrawalBtn.innerHTML;
    saveWithdrawalBtn.disabled = true;
    saveWithdrawalBtn.innerHTML = '<div class="loading"></div> Saving...';
    
    try {
        const response = await fetch('/saveWithdrawalInfo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                withdrawalMethod, 
                withdrawalAccount, 
                accountHolderName 
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusDiv.innerHTML = '✅ Withdrawal information saved successfully!';
            statusDiv.className = 'payment-status success';
            statusDiv.style.display = 'block';
            
            // Update saved info display
            document.getElementById('savedWithdrawalMethod').textContent = withdrawalMethod;
            document.getElementById('savedWithdrawalAccount').textContent = withdrawalAccount;
            document.getElementById('savedAccountHolder').textContent = accountHolderName;
            document.getElementById('savedWithdrawalInfo').style.display = 'block';
            
            // Enable withdrawal button if user has balance
            const profile = await loadProfileData();
            const withdrawBtn = document.getElementById('withdrawBtn');
            const withdrawalStatus = document.getElementById('withdrawalStatus');
            
            if (withdrawBtn && profile && profile.amount && parseFloat(profile.amount) > 0) {
                withdrawBtn.disabled = false;
                withdrawBtn.innerHTML = '<i>💰</i> Request Withdrawal';
                if (withdrawalStatus) {
                    withdrawalStatus.textContent = 'Ready for Withdrawal';
                    withdrawalStatus.className = 'status ready';
                }
            }
            
            // Hide message after 3 seconds
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
            
        } else {
            statusDiv.innerHTML = '❌ ' + result.message;
            statusDiv.className = 'payment-status error';
            statusDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error saving withdrawal info:', error);
        statusDiv.innerHTML = '❌ Error saving withdrawal information';
        statusDiv.className = 'payment-status error';
        statusDiv.style.display = 'block';
    } finally {
        saveWithdrawalBtn.disabled = false;
        saveWithdrawalBtn.innerHTML = originalText;
    }
}

// ===== UPLOAD FUNCTIONS =====

// Initialize upload system
function initializeUploadSystem() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        // Remove any existing listeners
        uploadForm.removeEventListener('submit', handleFileUpload);
        // Add new listener
        uploadForm.addEventListener('submit', handleFileUpload);
    }
    
    // Load user's uploads
    loadUserUploads();
}

// Handle file upload - SIMPLIFIED AND WORKING VERSION
async function handleFileUpload(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('mediaFile');
    const descriptionInput = document.getElementById('fileDescription');
    const description = descriptionInput ? descriptionInput.value : '';
    const statusDiv = document.getElementById('uploadStatus');
    const uploadBtn = e.target.querySelector('button[type="submit"]');
    
    // Validate file
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showUploadStatus('Please select a file', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (file.size > maxSize) {
        showUploadStatus('File size exceeds 5MB limit', 'error');
        return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
                          'application/pdf', 'application/msword', 
                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          'video/mp4', 'video/quicktime', 'video/x-msvideo'];
    
    if (!allowedTypes.includes(file.type)) {
        showUploadStatus('File type not allowed. Allowed: Images, PDF, DOC, MP4', 'error');
        return;
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('media', file);
    if (description) {
        formData.append('description', description);
    }
    
    // Show loading
    const originalText = uploadBtn.textContent;
    uploadBtn.disabled = true;
    uploadBtn.textContent = '📤 Uploading...';
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showUploadStatus('✅ File uploaded successfully!', 'success');
            fileInput.value = '';
            if (descriptionInput) descriptionInput.value = '';
            loadUserUploads(); // Refresh uploads list
        } else {
            showUploadStatus(`❌ ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showUploadStatus('❌ Error uploading file', 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = originalText;
    }
}

// Show upload status
function showUploadStatus(message, type = 'info') {
    const statusDiv = document.getElementById('uploadStatus');
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = `upload-status ${type}`;
    statusDiv.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// Load user's uploads
async function loadUserUploads() {
    const uploadsList = document.getElementById('myUploadsList');
    if (!uploadsList) return;
    
    try {
        const response = await fetch('/profileData');
        const profile = await response.json();
        
        if (!profile.uploads || profile.uploads.length === 0) {
            uploadsList.innerHTML = '<div class="no-uploads">No files uploaded yet</div>';
            return;
        }
        
        let html = '<div class="uploads-list">';
        
        // Show uploads in reverse order (newest first)
        [...profile.uploads].reverse().forEach((fileInfo, index) => {
            const filename = typeof fileInfo === 'string' ? fileInfo : fileInfo.filename;
            const fileExt = filename.split('.').pop().toLowerCase();
            let icon = '📄';
            
            if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExt)) icon = '🖼️';
            else if (['pdf'].includes(fileExt)) icon = '📕';
            else if (['doc', 'docx'].includes(fileExt)) icon = '📝';
            else if (['mp4', 'mov', 'avi'].includes(fileExt)) icon = '🎬';
            
            const date = new Date(parseInt(filename.split('-')[0]));
            const dateStr = date.toLocaleDateString();
            
            html += `
                <div class="upload-item">
                    <div style="display: flex; align-items: center;">
                        <span class="file-icon">${icon}</span>
                        <div class="upload-info">
                            <div class="upload-name">${typeof fileInfo === 'string' ? filename : fileInfo.originalName}</div>
                            <div class="upload-meta">
                                <span>Uploaded: ${dateStr}</span>
                                <span>Type: ${fileExt.toUpperCase()}</span>
                                ${typeof fileInfo === 'object' && fileInfo.description ? 
                                    `<span>Description: ${fileInfo.description}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="upload-actions">
                        <a href="/uploads/${filename}" class="btn-view" target="_blank">
                            View
                        </a>
                        <a href="/uploads/${filename}" class="btn-download" download="${filename}">
                            Download
                        </a>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        uploadsList.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading uploads:', error);
        uploadsList.innerHTML = '<div class="no-uploads">Error loading uploads</div>';
    }
}

// Request Withdrawal
async function requestWithdrawal() {
    const profile = await loadProfileData();
    
    if (!profile.withdrawalMethod || !profile.withdrawalAccount || !profile.accountHolderName) {
        alert('❌ Please save your withdrawal information first!');
        return;
    }
    
    if (!profile.amount || parseFloat(profile.amount) <= 0) {
        alert('❌ You have no balance to withdraw.');
        return;
    }
    
    if (profile.withdrawalRequested) {
        alert('⏳ You already have a pending withdrawal request.');
        return;
    }
    
    if (confirm(`Request withdrawal of ${profile.amount} PKR to ${profile.withdrawalMethod}: ${profile.withdrawalAccount} (${profile.accountHolderName})?`)) {
        try {
            const response = await fetch('/requestWithdrawal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            if (result.success) {
                alert('✅ Withdrawal request submitted! Admin will process it soon.');
                location.reload();
            } else {
                alert('❌ ' + result.message);
            }
        } catch (error) {
            console.error('Withdrawal error:', error);
            alert('❌ Error submitting withdrawal request');
        }
    }
}

// Delete Account
function deleteAccount() {
    if (confirm('⚠️ WARNING: This will permanently delete your account and all data!\n\nAre you absolutely sure?')) {
        if (confirm('This action cannot be undone. Type "DELETE" to confirm:')) {
            fetch('/deleteProfile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    alert('✅ Account deleted successfully!');
                    window.location.href = '/index.html';
                } else {
                    alert('❌ ' + result.message);
                }
            })
            .catch(error => {
                console.error('Delete error:', error);
                alert('❌ Error deleting account');
            });
        }
    }
}

// ===== ADMIN PAGE FUNCTIONS =====
if (window.location.pathname.includes('admin.html')) {
    document.addEventListener('DOMContentLoaded', async function() {
        // Load videos
        try {
            const response = await fetch('/getVideos');
            const videos = await response.json();
            
            if (videos.v1) document.getElementById('v1').value = videos.v1;
            if (videos.v2) document.getElementById('v2').value = videos.v2;
            if (videos.v3) document.getElementById('v3').value = videos.v3;
            if (videos.v4) document.getElementById('v4').value = videos.v4;
        } catch (error) {
            console.error('Error loading videos:', error);
        }
        
        // Load deposit methods
        try {
            const response = await fetch('/getDepositMethods');
            const methods = await response.json();
            
            if (methods[0]) {
                document.getElementById('method1Name').value = methods[0].name || '';
                document.getElementById('method1Number').value = methods[0].number || '';
            }
            if (methods[1]) {
                document.getElementById('method2Name').value = methods[1].name || '';
                document.getElementById('method2Number').value = methods[1].number || '';
            }
            if (methods[2]) {
                document.getElementById('method3Name').value = methods[2].name || '';
                document.getElementById('method3Number').value = methods[2].number || '';
            }
        } catch (error) {
            console.error('Error loading deposit methods:', error);
        }
        
        // Load users
        await loadUsers();
        
        // Load withdrawal info table
        await loadWithdrawalInfo();
        
        // Load video watch logs
        await loadVideoWatchLogs();
        
        // Save Videos Button
        const saveVideosBtn = document.getElementById('saveVideos');
        if (saveVideosBtn) {
            saveVideosBtn.addEventListener('click', async function() {
                const videos = {
                    v1: document.getElementById('v1').value,
                    v2: document.getElementById('v2').value,
                    v3: document.getElementById('v3').value,
                    v4: document.getElementById('v4').value
                };
                
                try {
                    const response = await fetch('/saveVideos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(videos)
                    });
                    
                    const result = await response.json();
                    showMessage('msg', result.message, result.success ? 'success' : 'error');
                } catch (error) {
                    console.error('Error saving videos:', error);
                    showMessage('msg', 'Error saving videos', 'error');
                }
            });
        }
        
        // Save Deposit Methods Button
        const saveDepositMethodsBtn = document.getElementById('saveDepositMethodsBtn');
        if (saveDepositMethodsBtn) {
            saveDepositMethodsBtn.addEventListener('click', async function() {
                const methods = [
                    {
                        name: document.getElementById('method1Name').value.trim(),
                        number: document.getElementById('method1Number').value.trim()
                    },
                    {
                        name: document.getElementById('method2Name').value.trim(),
                        number: document.getElementById('method2Number').value.trim()
                    },
                    {
                        name: document.getElementById('method3Name').value.trim(),
                        number: document.getElementById('method3Number').value.trim()
                    }
                ];
                
                // Filter out empty methods
                const validMethods = methods.filter(m => m.name && m.number);
                
                if (validMethods.length === 0) {
                    showMessage('depositMethodsMsg', 'Please add at least one deposit method', 'error');
                    return;
                }
                
                try {
                    const response = await fetch('/saveDepositMethods', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ methods: validMethods })
                    });
                    
                    const result = await response.json();
                    showMessage('depositMethodsMsg', result.message, result.success ? 'success' : 'error');
                } catch (error) {
                    console.error('Error saving deposit methods:', error);
                    showMessage('depositMethodsMsg', 'Error saving deposit methods', 'error');
                }
            });
        }
        
        // Update Users Button
        const updateUsersBtn = document.querySelector('#updateUsersBtn');
        if (updateUsersBtn) {
            updateUsersBtn.addEventListener('click', updateAllUsers);
        }
        
        // Reset Watched Videos Button
        const resetWatchedBtn = document.getElementById('resetWatchedBtn');
        if (resetWatchedBtn) {
            resetWatchedBtn.addEventListener('click', resetWatchedVideos);
        }
    });
}

// Load video watch logs for admin
async function loadVideoWatchLogs() {
    try {
        const response = await fetch('/getVideoWatchLogs');
        const logs = await response.json();
        
        const tableBody = document.querySelector('#videoWatchLogTable tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        if (logs.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #999;">
                        No video watch logs yet.
                    </td>
                </tr>
            `;
            return;
        }
        
        // Show latest logs first
        logs.reverse().forEach(log => {
            const row = document.createElement('tr');
            const date = new Date(log.timestamp);
            const formattedDate = date.toLocaleString();
            
            row.innerHTML = `
                <td>${log.userEmail}</td>
                <td>${log.videoIndex}</td>
                <td><a href="${log.videoUrl}" target="_blank" style="font-size: 12px;">${log.videoUrl.substring(0, 50)}...</a></td>
                <td>${log.plan || 'No Plan'}</td>
                <td style="color: #2ecc71; font-weight: bold;">${log.earnings} PKR</td>
                <td>${log.amountBefore} PKR</td>
                <td>${log.amountAfter} PKR</td>
                <td style="font-size: 12px;">${formattedDate}</td>
            `;
            tableBody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading video watch logs:', error);
        const tableBody = document.querySelector('#videoWatchLogTable tbody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #e74c3c;">
                        Error loading video watch logs
                    </td>
                </tr>
            `;
        }
    }
}

// Load users for admin dashboard
async function loadUsers() {
    try {
        const response = await fetch('/getUsers');
        const users = await response.json();
        
        const tableBody = document.querySelector('#usersTable tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            
            // Format uploaded media
            let uploadsHtml = '';
            if (user.uploads && user.uploads.length > 0) {
                // Check if uploads is array of strings or objects
                if (typeof user.uploads[0] === 'string') {
                    // Old format: array of filenames
                    uploadsHtml = user.uploads.map(upload => 
                        `<a href="/uploads/${upload}" class="download" target="_blank" download>${upload}</a>`
                    ).join('<br>');
                } else {
                    // New format: array of file objects
                    uploadsHtml = user.uploads.map(upload => 
                        `<a href="/uploads/${upload.filename}" class="download" target="_blank" download>${upload.originalName || upload.filename}</a>`
                    ).join('<br>');
                }
            } else {
                uploadsHtml = 'No uploads';
            }
            
            // Format watched videos
            const watchedCount = user.watched ? user.watched.length : 0;
            
            row.innerHTML = `
                <td>${user.email}</td>
                <td style="font-family: monospace; font-size: 12px; color: #e74c3c; font-weight: bold;">${user.password || 'No Password'}</td>
                <td>${user.plan || ''}</td>
                <td><input type="text" class="withdrawalLimit" value="${user.withdrawalLimit || ''}" data-email="${user.email}"></td>
                <td><input type="text" class="amount" value="${user.amount || '0'}" data-email="${user.email}" style="width: 80px;"></td>
                <td>${watchedCount}</td>
                <td>${user.addedPerson || 0}</td>
                <td style="font-size: 12px;">${user.referral || ''}</td>
                <td>${uploadsHtml}</td>
                <td>
                    <button class="grant-btn" data-email="${user.email}" ${user.email === 'admin@site.com' ? 'disabled' : ''}>
                        Grant Videos
                    </button>
                    <button class="delete-btn" data-email="${user.email}" ${user.email === 'admin@site.com' ? 'disabled' : ''}>
                        Delete
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Add event listeners to grant buttons
        document.querySelectorAll('.grant-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const email = this.getAttribute('data-email');
                try {
                    const response = await fetch('/grantVideoAccess', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    
                    const result = await response.json();
                    alert(result.message);
                    loadUsers(); // Reload users
                } catch (error) {
                    console.error('Error granting access:', error);
                    alert('Error granting video access');
                }
            });
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const email = this.getAttribute('data-email');
                if (confirm(`Are you sure you want to delete user: ${email}?`)) {
                    try {
                        const response = await fetch('/deleteUser', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email })
                        });
                        
                        const result = await response.json();
                        alert(result.message);
                        if (result.success) {
                            loadUsers(); // Reload users
                        }
                    } catch (error) {
                        console.error('Error deleting user:', error);
                        alert('Error deleting user');
                    }
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Load withdrawal information for admin dashboard
async function loadWithdrawalInfo() {
    try {
        const response = await fetch('/getUsers');
        const users = await response.json();
        
        const tableBody = document.querySelector('#withdrawalInfoTable tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        // Filter out admin and users without withdrawal info
        const usersWithWithdrawal = users.filter(user => 
            user.email !== 'admin@site.com' && 
            user.withdrawalMethod && 
            user.withdrawalAccount
        );
        
        if (usersWithWithdrawal.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #999;">
                        No users have saved withdrawal information yet.
                    </td>
                </tr>
            `;
            return;
        }
        
        usersWithWithdrawal.forEach(user => {
            const row = document.createElement('tr');
            
            // Style withdrawal status
            let statusHtml = '';
            if (user.withdrawalRequested) {
                statusHtml = `<span style="color: #f39c12; font-weight: bold;">⏳ Pending</span>`;
            } else if (user.amount && parseFloat(user.amount) > 0) {
                statusHtml = `<span style="color: #2ecc71; font-weight: bold;">✅ Ready</span>`;
            } else {
                statusHtml = `<span style="color: #95a5a6;">No Balance</span>`;
            }
            
            row.innerHTML = `
                <td>${user.email}</td>
                <td><strong>${user.withdrawalMethod || 'Not set'}</strong></td>
                <td style="font-family: monospace; font-weight: bold; color: #9b59b6;">${user.withdrawalAccount || 'Not set'}</td>
                <td>${user.accountHolderName || 'Not provided'}</td>
                <td>${user.plan || 'No Plan'}</td>
                <td style="font-weight: bold; color: #2ecc71;">${user.amount || '0'} PKR</td>
                <td>${statusHtml}</td>
                <td style="font-size: 12px;">
                    ${user.withdrawalMessage || 'No message'}
                </td>
            `;
            tableBody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading withdrawal info:', error);
        const tableBody = document.querySelector('#withdrawalInfoTable tbody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #e74c3c;">
                        Error loading withdrawal information
                    </td>
                </tr>
            `;
        }
    }
}

// Update all users function
async function updateAllUsers() {
    const rows = document.querySelectorAll('#usersTable tbody tr');
    const updates = [];
    
    rows.forEach(row => {
        const email = row.cells[0].textContent;
        const withdrawalLimitInput = row.querySelector('.withdrawalLimit');
        const amountInput = row.querySelector('.amount');
        
        if (withdrawalLimitInput && amountInput) {
            updates.push({
                email: email,
                withdrawalLimit: withdrawalLimitInput.value,
                amount: amountInput.value
            });
        }
    });
    
    if (updates.length === 0) {
        alert('No users to update');
        return;
    }
    
    try {
        const response = await fetch('/updateUsers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates })
        });
        
        const result = await response.json();
        if (result.success) {
            alert(`✅ ${result.message}`);
            loadUsers(); // Reload to show updated data
            loadWithdrawalInfo(); // Reload withdrawal info
        } else {
            alert(`❌ ${result.message}`);
        }
    } catch (error) {
        console.error('Error updating users:', error);
        alert('Error updating users');
    }
}

// Reset watched videos function
async function resetWatchedVideos() {
    if (confirm('Are you sure you want to reset watched videos for all users? This will allow them to watch videos again today.')) {
        try {
            const response = await fetch('/resetWatchedVideos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            if (result.success) {
                alert(`✅ ${result.message}`);
                loadUsers(); // Reload users
            } else {
                alert(`❌ ${result.message}`);
            }
        } catch (error) {
            console.error('Error resetting watched videos:', error);
            alert('Error resetting watched videos');
        }
    }
}

// ===== HOME PAGE FUNCTIONS =====
if (window.location.pathname.includes('home.html')) {
    document.addEventListener('DOMContentLoaded', async function() {
        // Load profile data
        await loadProfileData();
        
        // Plan selection
        document.querySelectorAll('.plan-card').forEach(card => {
            card.addEventListener('click', async function() {
                const plan = this.getAttribute('data-plan');
                
                try {
                    const response = await fetch('/selectPlan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ plan })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        // Update UI
                        document.querySelectorAll('.plan-card').forEach(c => {
                            c.classList.remove('selected-plan');
                        });
                        this.classList.add('selected-plan');
                        
                        // Update profile display
                        if (document.getElementById('userPlan')) {
                            document.getElementById('userPlan').textContent = plan;
                        }
                        
                        alert('✅ Plan selected successfully!');
                    } else {
                        alert('❌ ' + result.message);
                    }
                } catch (error) {
                    console.error('Error selecting plan:', error);
                    alert('Error selecting plan');
                }
            });
        });
        
        // File upload
        const uploadForm = document.getElementById('uploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const formData = new FormData(this);
                const uploadBtn = this.querySelector('button[type="submit"]');
                const originalText = uploadBtn.textContent;
                
                uploadBtn.disabled = true;
                uploadBtn.textContent = 'Uploading...';
                
                try {
                    const response = await fetch('/upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        alert('✅ File uploaded successfully!');
                        this.reset();
                    } else {
                        alert('❌ ' + result.message);
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    alert('Error uploading file');
                } finally {
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = originalText;
                }
            });
        }
    });
}

// ===== VIDEOS PAGE FUNCTIONS =====
if (window.location.pathname.includes('videos.html')) {
    document.addEventListener('DOMContentLoaded', async function() {
        try {
            const response = await fetch('/profileData');
            const profile = await response.json();
            
            const videoContainer = document.getElementById('videoContainer');
            if (videoContainer && profile.videos && profile.videos.length > 0) {
                videoContainer.innerHTML = '';
                profile.videos.forEach((videoUrl, index) => {
                    // Extract YouTube video ID
                    const videoId = videoUrl.includes('youtube.com/watch?v=') 
                        ? videoUrl.split('v=')[1].split('&')[0]
                        : null;
                    
                    if (videoId) {
                        const videoDiv = document.createElement('div');
                        videoDiv.className = 'video-item';
                        videoDiv.innerHTML = `
                            <h3>Video ${index + 1}</h3>
                            <div class="video-wrapper">
                                <iframe 
                                    src="https://www.youtube.com/embed/${videoId}" 
                                    frameborder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowfullscreen>
                                </iframe>
                            </div>
                            <div class="video-actions">
                                <button class="mark-watched-btn" data-index="${index}" data-url="${videoUrl}">
                                    ✅ Mark as Watched
                                </button>
                                <a href="${videoUrl}" target="_blank" class="watch-youtube-btn">📺 Open in YouTube</a>
                            </div>
                        `;
                        videoContainer.appendChild(videoDiv);
                    }
                });
                
                // Add event listeners to mark watched buttons
                document.querySelectorAll('.mark-watched-btn').forEach(btn => {
                    btn.addEventListener('click', async function() {
                        const videoIndex = this.getAttribute('data-index');
                        const videoUrl = this.getAttribute('data-url');
                        
                        try {
                            const response = await fetch('/markVideoWatched', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ videoIndex, videoUrl })
                            });
                            
                            const result = await response.json();
                            if (result.success) {
                                alert(`✅ Video marked as watched! You earned ${result.earnings} PKR`);
                                location.reload();
                            } else {
                                alert('❌ ' + result.message);
                            }
                        } catch (error) {
                            console.error('Error marking video as watched:', error);
                            alert('Error marking video as watched');
                        }
                    });
                });
            } else if (videoContainer) {
                videoContainer.innerHTML = '<p class="no-videos">No videos available. Please contact admin or select a plan.</p>';
            }
        } catch (error) {
            console.error('Error loading videos:', error);
        }
    });
}