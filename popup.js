// popup.js
console.log('popup.js');
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    switch (message.type) {
        case 'tips':
            if (message.status === 'success') {
                showSuccessMessage();
            } else if (message.status === 'error') {
                showErrorMessage();
            }
            break;
        default:
            console.error('Unrecognised message: ', message);
    }
});

document.getElementById('test').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {type: "test"});
    });
});

document.getElementById('refreshAll').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        chrome.tabs.sendMessage(tabs[0].id, {type: "refreshAll"});
    });
});

document.getElementById('extract').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        chrome.tabs.sendMessage(tabs[0].id, {type: "extract"});
    });
});

// 显示成功信息的函数
function showSuccessMessage() {
    const successDiv = document.getElementById('save-message');
    successDiv.textContent = '操作成功'; // 设置提示信息
    successDiv.style.display = 'block'; // 显示提示信息
    successDiv.style.color = 'green'; // 设置提示信息的颜色
    // 可以设置自动隐藏提示信息
    setTimeout(() => {
        successDiv.style.display = 'none'; // 5秒后隐藏提示信息
    }, 5000);
}

// 显示错误信息的函数
function showErrorMessage() {
    const errorDiv = document.getElementById('save-message');
    errorDiv.textContent = '操作失败'; // 设置提示信息
    errorDiv.style.display = 'block'; // 显示提示信息
    errorDiv.style.color = 'red'; // 设置提示信息的颜色
    // 可以设置自动隐藏提示信息
    setTimeout(() => {
        errorDiv.style.display = 'none'; // 5秒后隐藏提示信息
    }, 5000);
}


