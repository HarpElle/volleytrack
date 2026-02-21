
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env manully since we are running with node
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const apiKey = envConfig.EXPO_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ No API Key found in .env");
    process.exit(1);
}


console.log(`✅ Loaded API Key: ${apiKey.substring(0, 5)}...`);

const genAI = new GoogleGenerativeAI(apiKey);

async function listAvailableModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    console.log(`\n🔍 Fetching Model List from: ${url.replace(apiKey, 'API_KEY')}...`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Error:", data.error.message);
            return;
        }

        if (!data.models) {
            console.error("❌ No models returned in list!");
            console.log(JSON.stringify(data, null, 2));
            return;
        }

        console.log(`\n✅ Found ${data.models.length} Available Models:`);
        const availableModels = data.models.map(m => m.name.replace('models/', ''));

        // Filter for Gemini models
        const geminiModels = availableModels.filter(m => m.includes('gemini'));

        geminiModels.forEach(m => console.log(`   - ${m}`));

        return geminiModels;
    } catch (error) {
        console.error("❌ Network Error:", error.message);
    }
}

async function testWorkingModel(models) {
    if (!models || models.length === 0) return;

    console.log("\n🧪 Testing Generation on Available Models...");

    // Prioritize Flash models
    const sortedModels = models.sort((a, b) => {
        if (a.includes('flash') && !b.includes('flash')) return -1;
        if (!a.includes('flash') && b.includes('flash')) return 1;
        return 0;
    });

    for (const modelId of sortedModels) {
        // Skip vision-only or embedding models
        if (modelId.includes('vision') || modelId.includes('embedding')) continue;

        process.stdout.write(`👉 Testing ${modelId.padEnd(30)}: `);
        try {
            const model = genAI.getGenerativeModel({ model: modelId });
            const result = await model.generateContent("Hello!");
            await result.response; // Wait for response
            console.log(`✅ SUCCESS! WORKS!`);

            // If we find one that works, we stop!
            console.log(`\n🎉 WORKING MODEL FOUND: "${modelId}"`);
            console.log("Recommend updating GeminiService.ts to use this specific model ID.");
            return;
        } catch (error) {
            if (error.status === 429 || (error.message && error.message.includes("429"))) {
                console.log(`⚠️ QUOTA (429)`);
            } else {
                const msg = error.message || JSON.stringify(error);
                console.log(`❌ FAIL (${error.status || 'Error'}) - ${msg.substring(0, 100)}...`);
            }
        }
    }
    console.log("\n❌ No working models found in the available list.");
}

(async () => {
    const models = await listAvailableModels();
    await testWorkingModel(models);
})();

