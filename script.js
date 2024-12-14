// 在文件开头修改密码存储方式
const PASSWORD_KEY = 'system_password';
let SYSTEM_PASSWORD = localStorage.getItem(PASSWORD_KEY) || "123456";

// 显示修改密码弹窗
function showChangePassword() {
    document.getElementById('changePasswordModal').style.display = 'block';
}

// 隐藏修改密码弹窗
function hideChangePassword() {
    document.getElementById('changePasswordModal').style.display = 'none';
    // 清空输入框
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
}

// 修改密码
function changePassword() {
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // 验证原密码
    if (oldPassword !== SYSTEM_PASSWORD) {
        alert('原密码错误！');
        return;
    }

    // 验证新密码
    if (newPassword.length < 6) {
        alert('新密码长度不能少于6位！');
        return;
    }

    // 验证确认密码
    if (newPassword !== confirmPassword) {
        alert('两次输入的新密码不一致！');
        return;
    }

    // 更新密码
    SYSTEM_PASSWORD = newPassword;
    localStorage.setItem(PASSWORD_KEY, SYSTEM_PASSWORD);

    // 如果有 Firebase 连接，则保存到云端
    if (window.db) {
        const passwordRef = window.db.ref(window.db.database, 'system_password');
        window.db.set(passwordRef, SYSTEM_PASSWORD)
            .catch(e => console.error('保存密码到云端失败：', e));
    }

    alert('密码修改成功！');
    hideChangePassword();
}

// 修改登录函数
function login() {
    const password = document.getElementById('password').value;
    if (password === SYSTEM_PASSWORD) {
        sessionStorage.setItem('isLoggedIn', 'true');
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
        updateTable(); // 登录成功后更新表格
    } else {
        alert('密码错误，请重试！');
        document.getElementById('password').value = '';
    }
}

// 修改登录状态检查函数
function checkLoginStatus() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    
    if (isLoggedIn) {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
    } else {
        document.getElementById('loginForm').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
    }
    return isLoggedIn;
}

// 修改登出函数
function logout() {
    sessionStorage.removeItem('isLoggedIn');
    document.getElementById('loginForm').style.display = 'flex';
    document.getElementById('mainContainer').style.display = 'none';
}

// 修改页面加载事件
document.addEventListener('DOMContentLoaded', async () => {
    // 首先加载本地数据
    try {
        const savedPatents = localStorage.getItem('patents');
        if (savedPatents) {
            patents = JSON.parse(savedPatents);
        }
    } catch (e) {
        console.error('加载本地数据时出错：', e);
        patents = [];
    }

    // 设置实时数据同步
    if (window.db) {
        const patentsRef = window.db.ref(window.db.database, 'patents');
        window.db.onValue(patentsRef, (snapshot) => {
            const cloudPatents = snapshot.val();
            if (cloudPatents) {
                patents = cloudPatents;
                localStorage.setItem('patents', JSON.stringify(patents));
                // 只在登录状态下更新表格
                if (sessionStorage.getItem('isLoggedIn') === 'true') {
                    updateTable();
                }
            }
        });
    }

    // 检查登录状态并更新界面
    const isLoggedIn = checkLoginStatus();
    if (isLoggedIn) {
        updateTable(); // 登录状态下更新表格
    }

    // 加载密码
    if (window.db) {
        const passwordRef = window.db.ref(window.db.database, 'system_password');
        try {
            const snapshot = await window.db.get(passwordRef);
            const cloudPassword = snapshot.val();
            if (cloudPassword) {
                SYSTEM_PASSWORD = cloudPassword;
                localStorage.setItem(PASSWORD_KEY, SYSTEM_PASSWORD);
            }
        } catch (e) {
            console.error('从云端加载密码失败：', e);
        }
    }
});

// 存储专利数据的数组
let patents = [];

function submitPatent() {
    const patentName = document.getElementById('patentName').value.trim();
    const patentType = document.getElementById('patentType').value;
    const editingId = document.getElementById('inputForm').getAttribute('data-editing-id');
    let inventorDetails = [];
    
    // 验证专利类型
    if (!patentType) {
        alert('请选择专利类型！');
        return;
    }
    
    // 收集非空的发明人和比例
    for (let i = 1; i <= 6; i++) {
        const inventor = document.getElementById(`inventor${i}`).value.trim();
        const ratio = document.getElementById(`ratio${i}`).value.trim();
        
        if (inventor && ratio !== '') {
            inventorDetails.push({
                inventor: inventor,
                ratio: parseFloat(ratio)
            });
        }
    }
    
    // 验证输入
    if (!patentName) {
        alert('请输入专利名称！');
        return;
    }
    
    if (inventorDetails.length === 0) {
        alert('请至少输入一位发明人和对应的分配比例！');
        return;
    }
    
    // 计算总比例
    const totalRatio = inventorDetails.reduce((sum, detail) => sum + detail.ratio, 0);
    
    // 验证总比例是否为100
    if (Math.abs(totalRatio - 100) > 0.01) {
        alert('所有发明人的奖励分配比例之和必须等于100！当前总和为：' + totalRatio);
        return;
    }
    
    if (editingId) {
        // 编辑模式：更新现有记录
        const index = patents.findIndex(p => p.id.toString() === editingId);
        if (index !== -1) {
            patents[index] = {
                id: parseInt(editingId),
                patentName,
                patentType,
                inventorDetails
            };
        }
    } else {
        // 新增模式：添加新记录
        patents.push({
            id: Date.now(),
            patentName,
            patentType,
            inventorDetails
        });
    }
    
    // 保存更新
    saveToLocalStorage();
    
    // 清空表单和编辑标记
    clearForm();
    document.getElementById('inputForm').removeAttribute('data-editing-id');
    
    // 更新显示
    updateTable();
    showTable();
    
    // 显示成功消息
    alert(editingId ? '专利信息修改成功！' : '专利信息录入成功！');
}

// 清空表单
function clearForm() {
    document.getElementById('patentName').value = '';
    document.getElementById('patentType').value = '';
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`inventor${i}`).value = '';
        document.getElementById(`ratio${i}`).value = '';
    }
    document.getElementById('inputForm').removeAttribute('data-editing-id');
}

// 修改保存函数
function saveToLocalStorage() {
    try {
        // 保存到本地
        localStorage.setItem('patents', JSON.stringify(patents));
        
        // 如果有 Firebase 连接，则保存到云端
        if (window.db) {
            const patentsRef = window.db.ref(window.db.database, 'patents');
            window.db.set(patentsRef, patents)
                .then(() => console.log('数据已同步到云端'))
                .catch(error => console.error('云端同步失败：', error));
        }
    } catch (e) {
        console.error('保存数据时出错：', e);
        alert('保存到本地存储时出错，请确保有足够的存储空间。');
    }
}

// 返回录入页面
function backToForm() {
    document.getElementById('dataTable').style.display = 'none';
    document.getElementById('inputForm').style.display = 'block';
}

// 添加金额计算函数
function calculateAmount(patentType, ratio) {
    const baseAmount = patentType === "发明专利" ? 2000 : 1500;
    return (baseAmount * ratio / 100).toFixed(2); // 保留两位小数
}

// 导出为Excel文件
function exportToExcel() {
    // 1. 详细数据部分
    let csvContent = "=== 详细数据 ===\n";
    csvContent += "序号,专利名称,专利类型,发明人,奖励分配比例,金额\n";
    
    patents.forEach((patent, patentIndex) => {
        patent.inventorDetails.forEach((detail, detailIndex) => {
            const amount = calculateAmount(patent.patentType, detail.ratio);
            if (detailIndex === 0) {
                csvContent += `${patentIndex + 1},${patent.patentName},${patent.patentType},${detail.inventor},${detail.ratio}%,${amount}\n`;
            } else {
                csvContent += `,,,,${detail.ratio}%,${amount}\n`;
            }
        });
    });
    
    // 2. 专利类型统计
    csvContent += "\n=== 专利类型统计 ===\n";
    csvContent += "专利类型,数量\n";
    
    const typeStats = patents.reduce((acc, patent) => {
        acc[patent.patentType] = (acc[patent.patentType] || 0) + 1;
        return acc;
    }, {});
    
    Object.entries(typeStats).forEach(([type, count]) => {
        csvContent += `${type},${count}\n`;
    });
    
    // 3. 发明人统计
    csvContent += "\n=== 发明人参与统计 ===\n";
    csvContent += "发明人,参与专利数,总奖励比例,总金额\n";
    
    const inventorStats = {};
    patents.forEach(patent => {
        patent.inventorDetails.forEach(detail => {
            if (!inventorStats[detail.inventor]) {
                inventorStats[detail.inventor] = {
                    patentCount: 0,
                    totalRatio: 0
                };
            }
            inventorStats[detail.inventor].patentCount += 1;
            inventorStats[detail.inventor].totalRatio += detail.ratio;
        });
    });
    
    Object.entries(inventorStats).forEach(([inventor, stats]) => {
        // 计算总金额
        let totalAmount = 0;
        patents.forEach(patent => {
            const detail = patent.inventorDetails.find(d => d.inventor === inventor);
            if (detail) {
                totalAmount += parseFloat(calculateAmount(patent.patentType, detail.ratio));
            }
        });
        
        csvContent += `${inventor},${stats.patentCount},${stats.totalRatio}%,${totalAmount.toFixed(2)}\n`;
    });
    
    // 4. 专利类型-发明人交叉统计
    csvContent += "\n=== 专利类型-发明人交叉统计 ===\n";
    csvContent += "发明人,发明专利数,实用新型专利数\n";
    
    const crossStats = {};
    patents.forEach(patent => {
        patent.inventorDetails.forEach(detail => {
            if (!crossStats[detail.inventor]) {
                crossStats[detail.inventor] = {
                    invention: 0,
                    utility: 0
                };
            }
            if (patent.patentType === "发明专利") {
                crossStats[detail.inventor].invention += 1;
            } else if (patent.patentType === "实用新型专利") {
                crossStats[detail.inventor].utility += 1;
            }
        });
    });
    
    Object.entries(crossStats).forEach(([inventor, stats]) => {
        csvContent += `${inventor},${stats.invention},${stats.utility}\n`;
    });

    // 导出文件
    const blob = new Blob(["\ufeff" + csvContent], { 
        type: 'text/csv;charset=utf-8;' 
    });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', '专利信息汇总.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 更新表格显示
function updateTable() {
    const tableBody = document.getElementById('patentTableBody');
    tableBody.innerHTML = '';

    patents.forEach((patent, index) => {
        // 添加专利行
        const patentRow = document.createElement('tr');
        patentRow.className = 'patent-group';
        
        // 计算第一个发明人的金额
        const amount1 = calculateAmount(patent.patentType, patent.inventorDetails[0].ratio);
        
        patentRow.innerHTML = `
            <td rowspan="${patent.inventorDetails.length}">${index + 1}</td>
            <td rowspan="${patent.inventorDetails.length}">${patent.patentName}</td>
            <td rowspan="${patent.inventorDetails.length}">${patent.patentType}</td>
            <td>${patent.inventorDetails[0].inventor}</td>
            <td>${patent.inventorDetails[0].ratio}%</td>
            <td>${amount1}</td>
            <td rowspan="${patent.inventorDetails.length}">
                <button onclick="editPatent(${patent.id})" class="action-button edit-button">编辑</button>
                <button onclick="deletePatent(${patent.id})" class="action-button delete-button">删除</button>
            </td>
        `;
        tableBody.appendChild(patentRow);

        // 添加其他发明人行
        for (let i = 1; i < patent.inventorDetails.length; i++) {
            const inventorRow = document.createElement('tr');
            inventorRow.className = 'inventor-row';
            
            // 计算其他发明人的金额
            const amount = calculateAmount(patent.patentType, patent.inventorDetails[i].ratio);
            
            inventorRow.innerHTML = `
                <td>${patent.inventorDetails[i].inventor}</td>
                <td>${patent.inventorDetails[i].ratio}%</td>
                <td>${amount}</td>
            `;
            tableBody.appendChild(inventorRow);
        }
    });

    // 更新统计信息
    updateStatistics();
}

function updateStatistics() {
    // 1. 专利类型统计
    const typeStats = patents.reduce((acc, patent) => {
        acc[patent.patentType] = (acc[patent.patentType] || 0) + 1;
        return acc;
    }, {});
    
    const typeStatsBody = document.querySelector('#typeStatsTable tbody');
    typeStatsBody.innerHTML = Object.entries(typeStats)
        .map(([type, count]) => `
            <tr>
                <td>${type}</td>
                <td>${count}</td>
            </tr>
        `).join('');

    // 2. 发明人统计
    const inventorStats = {};
    patents.forEach(patent => {
        patent.inventorDetails.forEach(detail => {
            if (!inventorStats[detail.inventor]) {
                inventorStats[detail.inventor] = {
                    patentCount: 0,
                    totalRatio: 0
                };
            }
            inventorStats[detail.inventor].patentCount += 1;
            inventorStats[detail.inventor].totalRatio += detail.ratio;
        });
    });
    
    const inventorStatsBody = document.querySelector('#inventorStatsTable tbody');
    inventorStatsBody.innerHTML = Object.entries(inventorStats)
        .map(([inventor, stats]) => {
            // 计算总金额
            let totalAmount = 0;
            patents.forEach(patent => {
                const detail = patent.inventorDetails.find(d => d.inventor === inventor);
                if (detail) {
                    totalAmount += parseFloat(calculateAmount(patent.patentType, detail.ratio));
                }
            });
            
            return `
                <tr>
                    <td>${inventor}</td>
                    <td>${stats.patentCount}</td>
                    <td>${stats.totalRatio}%</td>
                    <td>${totalAmount.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

    // 3. 交叉统计
    const crossStats = {};
    patents.forEach(patent => {
        patent.inventorDetails.forEach(detail => {
            if (!crossStats[detail.inventor]) {
                crossStats[detail.inventor] = {
                    invention: 0,
                    utility: 0
                };
            }
            if (patent.patentType === "发明专利") {
                crossStats[detail.inventor].invention += 1;
            } else if (patent.patentType === "实用新型专利") {
                crossStats[detail.inventor].utility += 1;
            }
        });
    });
    
    const crossStatsBody = document.querySelector('#crossStatsTable tbody');
    crossStatsBody.innerHTML = Object.entries(crossStats)
        .map(([inventor, stats]) => `
            <tr>
                <td>${inventor}</td>
                <td>${stats.invention}</td>
                <td>${stats.utility}</td>
            </tr>
        `).join('');
}

// 删除专利
function deletePatent(patentId) {
    if (confirm('确要删除这条专利记录吗？')) {
        patents = patents.filter(p => p.id !== patentId);
        saveToLocalStorage();
        updateTable();
    }
}

// 编辑专利
function editPatent(patentId) {
    const patent = patents.find(p => p.id === patentId);
    if (!patent) return;

    // 切换到录入页面
    backToForm();
    
    // 填充表单
    document.getElementById('patentName').value = patent.patentName;
    document.getElementById('patentType').value = patent.patentType;
    
    // 先清空所有输入框
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`inventor${i}`).value = '';
        document.getElementById(`ratio${i}`).value = '';
    }
    
    // 填充发明人和比例
    patent.inventorDetails.forEach((detail, index) => {
        const i = index + 1;
        document.getElementById(`inventor${i}`).value = detail.inventor;
        document.getElementById(`ratio${i}`).value = detail.ratio;
    });
    
    // 标记为编辑模式
    document.getElementById('inputForm').setAttribute('data-editing-id', patentId);
}

function showTable() {
    document.getElementById('inputForm').style.display = 'none';
    document.getElementById('dataTable').style.display = 'block';
} 