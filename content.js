// content.js
console.log('content.js');
chrome.runtime.onMessage.addListener(
    function(message, sender, sendResponse) {
        switch (message.type) {
            case 'extract':
                console.log('extract');
                extractAndSendHtml();
                break;
            case 'refreshAll':
                console.log('refreshAll');
                refreshAll();
                break;
            case 'test':
                console.log('test');
                chrome.runtime.sendMessage({type: 'tips', status: 'success'});
                break;
            default:
                console.error('Unrecognised message: ', message);
        }
    }
);

const parseContent = (content) => {
    if (!content) return "";
    // Parse unicode escaped characters
    let retVal = content.replace(/"/g, '\\"').replace(/(?:\r\n|\r|\n)/g, '\\n');
    retVal = retVal.replace(/\\u([\d\w]{4})/gi, function (match, grp) {
      return String.fromCharCode(parseInt(grp, 16));
    });
    retVal = retVal.replace(/\\n/g, '\n');
    retVal = retVal.replace(/\\t/g, '\t');
    retVal = retVal.replace(/\\r/g, '\r');
    retVal = retVal.replace(/\\b/g, '\b');
    retVal = retVal.replace(/\\f/g, '\f');
    retVal = retVal.replace(/\\'/g, '\'');
    retVal = retVal.replace(/\\"/g, '\"');
    retVal = retVal.replace(/\\\\/g, '\\');
    return retVal;
  };

function refreshAll() {
    fetch('https://apscheduler.us.admin.dora.run/email/list_templates', {
        method: 'GET'
    })
    .then(response => response.json()) // 确保处理响应数据
    .then(data => {
        const templates = data.data.TemplatesMetadata;
        (async function() {  // 定义并立即执行一个异步匿名函数
            for (const template of templates) {
                console.log(template.Name);
                try {
                    const response = await fetch('https://apscheduler.us.admin.dora.run/email/get_template?template_name=' + template.Name, {method: 'GET'});
                    const data = await response.json();
                    
                    const fetchedTemplate = data.data.Template;
                    await refreshHtml(fetchedTemplate.TemplateName, fetchedTemplate.SubjectPart, fetchedTemplate.TextPart, fetchedTemplate.HtmlPart);
                    
                    console.log('refreshed: ' + fetchedTemplate.TemplateName);
                } catch (error) {
                    console.error('Error processing template:', error);
                }
            }
            console.log('All templates refreshed, count: ', templates.length);
            chrome.runtime.sendMessage({type: 'tips', status: 'success'});
        })();  // 立即执行这个异步函数
    })
    .catch((error) => {
        console.error('Error:', error);
        chrome.runtime.sendMessage({type: 'tips', status: 'error'});
    });
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
        // 假设 htmlContent 是从某个元素的 srcdoc 属性获取的 HTML 字符串
        var htmlContent = htmlElement.getAttribute('srcdoc');
        refreshHtml(template_name, subjectValue, previewTextValue, htmlContent).then(() => {
            chrome.runtime.sendMessage({type: 'tips', status: 'success'});
        });
    } else {
        console.error(document.documentElement.outerHTML);
        console.error('The specific HTML element could not be found.');
        chrome.runtime.sendMessage({type: 'tips', status: 'error'});
    }
}

function refreshHtml(template_name, subjectValue, previewTextValue, htmlContent) {
    // 使用 DOMParser 解析 HTML 字符串
    var parser = new DOMParser();
    var doc = parser.parseFromString(htmlContent, 'text/html');
    var shouldRefresh = false;

    // 去除loops的底部logo
    const tdElements = doc.querySelectorAll('td');
    tdElements.forEach(td => {
        // 检查当前 <td> 元素内是否包含特定的文本内容
        if (td.getAttribute('class')==='powered-by-image' || td.getAttribute('class')==='powered-by-image-dark') {
            // 如果包含，则移除这个 <td> 元素
            console.log('remove loops logo');
            shouldRefresh = true;
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
            shouldRefresh = true;
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
            shouldRefresh = true;
            a.setAttribute('href', '{{unsub}}');
        }
        // 对未添加点击率追踪的固定http链接添加点击率追踪, 不替换包含模板变量的链接
        if (a.getAttribute('href') && 
        a.getAttribute('href').startsWith('http') &&
        !a.getAttribute('href').includes('{{')){
            console.log('track click: ' + a.getAttribute('href'));
            shouldRefresh = true;
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
        console.log('add track open');
        shouldRefresh = true;
    }

    // 将更新后的 HTML 内容转换回字符串
    var updatedHtmlContent = doc.body.innerHTML;
    if (shouldRefresh) {
        return fetch('https://apscheduler.us.admin.dora.run/email/store_email_template', {
    
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ template_content: parseContent(updatedHtmlContent), template_name: parseContent(template_name), subject: parseContent(subjectValue), preview_text: parseContent(previewTextValue)})
        })
        .then(response => response.json()) // 确保处理响应数据
        .then(data => {
            console.log('Success:', data);
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    } else {
        console.log('No changes detected');
        return Promise.resolve();
    }
}