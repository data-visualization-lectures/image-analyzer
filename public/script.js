document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const uploadForm = document.getElementById('uploadForm');
    const resultsArea = document.getElementById('resultsArea');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const thresholdRange = document.getElementById('thresholdRange');
    const thresholdValue = document.getElementById('thresholdValue');

    let selectedFile = null;

    // --- Event Listeners ---

    // Dropzone logic
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Slider logic
    thresholdRange.addEventListener('input', (e) => {
        thresholdValue.textContent = e.target.value;
    });

    // Form logic
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile) return;
        await startAnalysis();
    });

    // --- Functions ---

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (!file.type.startsWith('image/')) {
                alert('画像ファイルをアップロードしてください。');
                return;
            }

            selectedFile = file;
            analyzeBtn.disabled = false;

            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById('previewImage');
                img.src = e.target.result;
                img.classList.remove('hidden');
                document.getElementById('dropzoneContent').classList.add('hidden');
            };
            reader.readAsDataURL(file);

        } else {
            selectedFile = null;
            analyzeBtn.disabled = true;
            document.getElementById('previewImage').classList.add('hidden');
            document.getElementById('dropzoneContent').classList.remove('hidden');
        }
    }

    async function startAnalysis() {
        loadingOverlay.classList.remove('hidden');
        resultsArea.innerHTML = '';
        const paletteArea = document.getElementById('paletteArea');
        paletteArea.innerHTML = '';
        paletteArea.classList.add('hidden');

        const formData = new FormData();
        formData.append('image', selectedFile);

        // Convert Level (0-10) to Distance Threshold (approx 0-150)
        const level = parseInt(thresholdRange.value, 10);
        const distanceThreshold = level * 15;
        formData.append('threshold', distanceThreshold);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                renderResult(data.result);
            } else {
                alert('分析に失敗しました: ' + (data.message || '不明なエラー'));
            }

        } catch (error) {
            console.error(error);
            alert('アップロード中にエラーが発生しました。');
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    function renderResult(res) {
        // 1. Render Palette Strip
        const paletteArea = document.getElementById('paletteArea');
        paletteArea.classList.remove('hidden');

        const paletteRow = document.createElement('div');
        paletteRow.className = 'card palette-row';

        const title = document.createElement('h4');
        title.textContent = `パレット: ${res.filename}`;
        paletteRow.appendChild(title);

        const strip = document.createElement('div');
        strip.className = 'palette-strip';

        const topColors = res.colors.slice(0, 50);
        topColors.forEach(color => {
            const chip = document.createElement('div');
            chip.className = 'palette-chip';
            chip.style.backgroundColor = color.hex;
            chip.title = `${color.hex} (${color.percentage})`;
            chip.style.flexGrow = color.count;
            strip.appendChild(chip);
        });

        paletteRow.appendChild(strip);
        paletteArea.appendChild(paletteRow);

        // 2. Render Table Card
        const template = document.getElementById('resultTemplate');
        const clone = template.content.cloneNode(true);

        clone.querySelector('.filename').textContent = res.filename;
        clone.querySelector('.unique-count').textContent = `${res.uniqueColorGroups} 色グループ`;

        const tbody = clone.querySelector('tbody');
        const LIMIT = 100;

        res.colors.slice(0, LIMIT).forEach(color => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><div class="swatch" style="background-color: ${color.hex}"></div></td>
                <td>${color.hex}</td>
                <td>${color.rgb}</td>
                <td>${color.count}</td>
                <td>${color.percentage}</td>
                <td>${color.mergedColors || 0}</td>
            `;
            tbody.appendChild(tr);
        });

        if (res.colors.length > LIMIT) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="6" style="text-align:center; color:#888;">... 他 ${res.colors.length - LIMIT} 色 (すべて見るにはCSVをダウンロード)</td>`;
            tbody.appendChild(tr);
        }

        const downloadBtn = clone.querySelector('.download-btn');
        downloadBtn.onclick = () => downloadCSV(res.colors, res.filename);

        resultsArea.appendChild(clone);
    }

    function downloadCSV(colors, filename) {
        if (!colors || colors.length === 0) {
            alert("ダウンロードするデータがありません。");
            return;
        }

        let csvContent = "";
        // Add BOM for Excel compatibility with UTF-8
        csvContent += "\uFEFF";
        csvContent += "Hex,RGB,カウント,割合,統合された色数\n";

        colors.forEach(c => {
            // Escape RGB string just in case
            const row = [
                c.hex,
                `"${c.rgb}"`,
                c.count,
                c.percentage,
                c.mergedColors
            ].join(",");
            csvContent += row + "\n";
        });

        // Use Blob for reliable download of large data
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `palette_${filename}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
});
