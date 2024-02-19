document.getElementById('test').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            function: test
        });
    });
});

function test() {
    console.log('test');
}

document.getElementById('extract').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            function: extractAndSendHtml
        });
    });
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.status === 'success') {
        showSuccessMessage();
    } else if (message.status === 'error') {
        showErrorMessage();
    }
});

// 显示成功信息的函数
function showSuccessMessage() {
    const successDiv = document.getElementById('save-message');
    successDiv.textContent = '保存成功'; // 设置提示信息
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
    errorDiv.textContent = '保存失败'; // 设置提示信息
    errorDiv.style.display = 'block'; // 显示提示信息
    errorDiv.style.color = 'red'; // 设置提示信息的颜色
    // 可以设置自动隐藏提示信息
    setTimeout(() => {
        errorDiv.style.display = 'none'; // 5秒后隐藏提示信息
    }, 5000);
}

function extractAndSendHtml() {

    // 提取邮件主题和预览文本
    const paragraphs = document.querySelectorAll('p');
    let subjectValue = '';
    let previewTextValue = '';
    paragraphs.forEach(p => {
    // 检查<p>元素的文本内容是否为'Subject'或'Preview Text'
    if (p.textContent.includes('Subject')) {
        const nextSibling = p.nextElementSibling;
        subjectValue = nextSibling ? nextSibling.textContent.trim() : '';
    } else if (p.textContent.includes('Preview Text')) {
        const nextSibling = p.nextElementSibling;
        previewTextValue = nextSibling ? nextSibling.textContent.trim() : '';
    }
    });
    console.log('Subject:', subjectValue);
    console.log('Preview Text:', previewTextValue);

    // 提取邮件模板名称
    const element = document.querySelector('.line-clamp-1');
    let template_name = ''
    if (element) {
        // 查找并移除 <span> 子元素
        const spanElement = element.querySelector('span');
        if (spanElement) {
            spanElement.remove();
        }
        template_name = element.textContent.trim();
        console.log('template_name:', template_name);  // 输出提取到的文本
    } else {
        console.log('template_name not found');
    }

    // 发送请求
    const htmlElement = document.querySelector('iframe[title="Summary of the email"]');
    if (htmlElement) {
        console.log('send message')
        // 假设 htmlContent 是从某个元素的 srcdoc 属性获取的 HTML 字符串
        var htmlContent = htmlElement.getAttribute('srcdoc');

        // 使用 DOMParser 解析 HTML 字符串
        var parser = new DOMParser();
        var doc = parser.parseFromString(htmlContent, 'text/html');

        // 去除loops的底部logo
        const tdElements = doc.querySelectorAll('td');
        tdElements.forEach(td => {
            // 检查当前 <td> 元素内是否包含特定的文本内容
            if (td.getAttribute('class')==='powered-by-image' || td.getAttribute('class')==='powered-by-image-dark') {
                // 如果包含，则移除这个 <td> 元素
                console.log('remove loops logo');
                td.remove();
            }
        });

        // 去除semplates的span元素的data-buffer属性
        const spanElements = doc.querySelectorAll('span');
        spanElements.forEach(span => {
            // 检查当前 <span> 元素内是否包含特定的属性
            if (span.getAttribute('data-buffer')) {
                // 如果包含，则移除这个 <span> 元素的data-buffer属性
                console.log('remove data-buffer');
                span.removeAttribute('data-buffer');
            }
        });

        // 修改loops自带的取消订阅链接
        const aElements = doc.querySelectorAll('a');
        aElements.forEach(a => {
            // 检查当前 <a> 标签内是否包含特定的文本内容
            if (a.getAttribute('href')==='{unsubscribe_link}') {
                // 如果包含，则修改这个 <a> 元素
                console.log('alter unsub link');
                a.setAttribute('href', '{{unsub}}');
            }
            // 对未添加点击率追踪的固定链接添加点击率追踪
            if (a.getAttribute('href') && a.getAttribute('href').includes('http') && !a.getAttribute('href').includes('email/track/click')) {
                console.log('track click: ' + a.getAttribute('href'));
                var newHref = "https://api-us.dora.run/email/track/click?project=1&env=online&template_name={{templateName}}&username={{username}}&target_url=" + encodeURIComponent(a.getAttribute('href'));
                a.setAttribute('href', newHref);
            }
        });

        // 添加打开率追踪, 插入到</body>前
        const imageElements = doc.querySelectorAll('img');
        var trackOpen = false;
        imageElements.forEach(img => {
            if (img.getAttribute('src')==='{{trackOpen}}') {
                trackOpen = true;
            }
        });
        if (!trackOpen) {
            const img = doc.createElement('img');
            img.setAttribute('src', '{{trackOpen}}');
            img.setAttribute('style', 'display: none;');
            const body = doc.querySelector('body');
            body.appendChild(img);
        }

        // 将更新后的 HTML 内容转换回字符串
        var updatedHtmlContent = doc.body.innerHTML;

        fetch('https://apscheduler.us.admin.dora.run/email/store_email_template', {
          
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ template_content: updatedHtmlContent, template_name: template_name, subject: subjectValue, preview_text: previewTextValue})
        })
        .then(response => response.json()) // 确保处理响应数据
        .then(data => {
            console.log('Success:', data);
            chrome.runtime.sendMessage({status: 'success'});
        })
        .catch((error) => {
            console.error('Error:', error);
            chrome.runtime.sendMessage({status: 'error'});
        });
    } else {
        console.error(document.documentElement.outerHTML);
        console.error('The specific HTML element could not be found.');
    }
}
  