document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const imagePreview = document.getElementById('imagePreview');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resultDiv = document.getElementById('result');

    let selectedFile = null;
    const appId = '__APP_SLUG__';

    browseBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', handleFileSelect);

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach((eventName) => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropZone.classList.add('dragover');
    }

    function unhighlight() {
        dropZone.classList.remove('dragover');
    }

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(event) {
        const files = event.dataTransfer?.files;
        if (files?.length) {
            handleFiles(files[0]);
        }
    }

    function handleFileSelect(event) {
        if (event.target.files.length) {
            handleFiles(event.target.files[0]);
        }
    }

    function handleFiles(file) {
        if (!file.type.match('image.*')) {
            alert('请选择图片文件（JPEG、PNG、GIF 等）');
            return;
        }

        selectedFile = file;

        const reader = new FileReader();
        reader.onload = (event) => {
            imagePreview.src = event.target.result;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);

        analyzeBtn.disabled = false;
    }

    analyzeBtn.addEventListener('click', analyzeImage);
    resetBtn.addEventListener('click', resetForm);

    async function analyzeImage() {
        if (!selectedFile) {
            alert('请先选择一张图片');
            return;
        }

        resultDiv.textContent = '正在分析图片...';
        resultDiv.classList.add('loading');
        analyzeBtn.disabled = true;

        try {
            const base64 = await fileToBase64(selectedFile);
            const result = await callMultimodalAPI(base64, selectedFile.type);

            resultDiv.classList.remove('loading', 'error');
            renderResult('分析结果：', result);
        } catch (error) {
            console.error('分析失败:', error);
            resultDiv.classList.remove('loading');
            resultDiv.classList.add('error');
            renderResult('分析失败：', error instanceof Error ? error.message : '未知错误');
        } finally {
            analyzeBtn.disabled = false;
        }
    }

    function renderResult(title, message) {
        resultDiv.replaceChildren();
        const heading = document.createElement('strong');
        heading.textContent = title;
        const content = document.createElement('p');
        content.textContent = String(message || '');
        resultDiv.append(heading, content);
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                resolve(reader.result.split(',')[1]);
            };
            reader.onerror = (error) => reject(error);
        });
    }

    async function callMultimodalAPI(imageBase64, mimeType) {
        const requestBody = {
            appId,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: '请详细描述这张图片的内容，如果是包含文字的图片，请准确识别并提取所有文字内容。如果是图表或图形，请描述其中的信息。'
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${imageBase64}`,
                                detail: 'high'
                            }
                        }
                    ]
                }
            ],
            temperature: 0.1,
            max_tokens: 1000
        };

        const response = await fetch(`${window.location.origin}/api/llm/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败: ${response.status} - ${errorText}`);
        }

        const payload = await response.json();
        return payload.choices?.[0]?.message?.content || '未能获取分析结果';
    }

    function resetForm() {
        fileInput.value = '';
        selectedFile = null;
        imagePreview.style.display = 'none';
        imagePreview.src = '';
        analyzeBtn.disabled = true;
        resultDiv.classList.remove('loading', 'error');
        resultDiv.innerHTML = '';
    }
});
