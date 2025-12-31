const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

// Serve static files from 'public' directory
app.use(express.static('public'));

// Helper: Calculate Euclidean distance betwen two colors
function getColorDistance(c1, c2) {
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
    );
}

// Helper: RGB to Hex
function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Main Logic: Analyze a single image buffer
 * 1. Extract exact colors
 * 2. Group similar colors if threshold > 0
 */
async function analyzeImage(buffer, threshold) {
    // 1. Get raw pixel data (RGBA)
    const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // 2. Count exact unique colors
    const colorMap = new Map();
    const pixelCount = info.width * info.height;

    for (let i = 0; i < data.length; i += 4) {
        // Skip fully transparent pixels if needed (optional)
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // const a = data[i + 3]; 

        const key = `${r},${g},${b}`;
        colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }

    // Convert Map to Array of Objects
    let colors = [];
    colorMap.forEach((count, key) => {
        const [r, g, b] = key.split(',').map(Number);
        colors.push({ r, g, b, count });
    });

    // Sort by count descending
    colors.sort((a, b) => b.count - a.count);

    // 3. Group similar colors (if threshold > 0)
    // Naive Greedy Algorithm: Pick most frequent color, swallow neighbors, repeat.
    if (threshold > 0) {
        const groupedColors = [];
        const processedIndices = new Set();

        for (let i = 0; i < colors.length; i++) {
            if (processedIndices.has(i)) continue;

            const leader = colors[i];
            let groupCount = leader.count;
            let mergedCount = 0; // How many color variants merged

            processedIndices.add(i);

            // Find neighbors
            for (let j = i + 1; j < colors.length; j++) {
                if (processedIndices.has(j)) continue;

                const neighbor = colors[j];
                const dist = getColorDistance(leader, neighbor);

                if (dist <= threshold) {
                    groupCount += neighbor.count;
                    mergedCount++;
                    processedIndices.add(j);
                }
            }

            groupedColors.push({
                ...leader,
                count: groupCount,
                mergedColorsCount: mergedCount,
                isGroupLeader: true
            });
        }
        colors = groupedColors;
        // Re-sort after grouping (counts changed)
        colors.sort((a, b) => b.count - a.count);
    }

    // 4. Format final result
    return colors.map(c => ({
        hex: rgbToHex(c.r, c.g, c.b),
        rgb: `rgb(${c.r}, ${c.g}, ${c.b})`,
        count: c.count,
        percentage: ((c.count / pixelCount) * 100).toFixed(2) + "%",
        mergedColors: c.mergedColorsCount || 0
    }));
}

// API Endpoint: POST /api/analyze
app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        const threshold = parseFloat(req.body.threshold) || 0;
        const file = req.file;

        try {
            const analyzedColors = await analyzeImage(file.buffer, threshold);

            const result = {
                filename: file.originalname,
                totalPixels: 0,
                uniqueColorGroups: analyzedColors.length,
                colors: analyzedColors.slice(0, 1000)
            };

            res.json({ success: true, result: result });

        } catch (err) {
            console.error(`Error processing file ${file.originalname}:`, err);
            res.status(500).json({ success: false, message: "Failed to process image." });
        }

    } catch (error) {
        console.error('Global error:', error);
        res.status(500).json({ success: false, message: 'Server error processing image.' });
    }
});

// Start server if not running in Vercel (local development)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

// Export the app for Vercel Serverless Functions
module.exports = app;
