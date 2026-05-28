// Initialize Lucide Icons
lucide.createIcons();

// --- DOM Elements ---
const apiKeyModal = document.getElementById('apiKeyModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const apiKeyInput = document.getElementById('apiKey');

const formSection = document.getElementById('formSection');
const menuForm = document.getElementById('menuForm');
const ingredientInput = document.getElementById('ingredientInput');
const ingredientsList = document.getElementById('ingredientsList');

const loadingSection = document.getElementById('loadingSection');
const resultSection = document.getElementById('resultSection');
const errorSection = document.getElementById('errorSection');
const errorTitle = document.getElementById('errorTitle');
const errorMessage = document.getElementById('errorMessage');
const errorBackBtn = document.getElementById('errorBackBtn');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const menuContainer = document.getElementById('menuContainer');
const shoppingListContainer = document.getElementById('shoppingListContainer');

const shareBtn = document.getElementById('shareBtn');
const resetBtn = document.getElementById('resetBtn');
const toast = document.getElementById('toast');

// --- State ---
let ingredients = [];
let generatedData = null;

// --- Initialization ---
function init() {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
    } else {
        apiKeyModal.classList.remove('hidden');
    }

    // Check for shared data in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('data');
    if (sharedData) {
        try {
            const decompressed = LZString.decompressFromEncodedURIComponent(sharedData);
            if (decompressed) {
                generatedData = JSON.parse(decompressed);
                renderResults(generatedData);
                formSection.classList.add('hidden');
                resultSection.classList.remove('hidden');
            }
        } catch (e) {
            console.error('Failed to parse shared data', e);
        }
    }
}

// --- API Key Management ---
settingsBtn.addEventListener('click', () => apiKeyModal.classList.remove('hidden'));
closeSettingsBtn.addEventListener('click', () => apiKeyModal.classList.add('hidden'));
saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        apiKeyModal.classList.add('hidden');
    } else {
        alert('APIキーを入力してください。');
    }
});

// --- Tag Input (Ingredients) ---
ingredientInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const value = ingredientInput.value.trim();
        if (value && !ingredients.includes(value)) {
            ingredients.push(value);
            renderIngredients();
        }
        ingredientInput.value = '';
    }
});

function renderIngredients() {
    ingredientsList.innerHTML = '';
    ingredients.forEach((ing, index) => {
        const li = document.createElement('li');
        li.className = 'tag';
        li.innerHTML = `${ing} <i data-lucide="x" onclick="removeIngredient(${index})"></i>`;
        ingredientsList.appendChild(li);
    });
    lucide.createIcons();
}

window.removeIngredient = (index) => {
    ingredients.splice(index, 1);
    renderIngredients();
};

// --- Form Submission & API Call ---
menuForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        apiKeyModal.classList.remove('hidden');
        return;
    }

    const adults = document.getElementById('adults').value;
    const children = document.getElementById('children').value;
    const days = document.getElementById('days').value;
    const purpose = document.getElementById('purpose').value;

    formSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');

    const promptText = `
あなたはプロの栄養士であり、料理研究家です。以下の条件に基づいて、最大${days}日分の献立（朝・昼・夕）を提案してください。
【条件】
- 家族構成: 大人${adults}人、子供${children}人
- 提案日数: ${days}日分
- 目的・要望: ${purpose}
- 冷蔵庫にある食材: ${ingredients.length > 0 ? ingredients.join('、') : '特になし'}
- 時短料理を心がけてください。

【出力要件】
必ず以下の構造を持つJSON形式のみを出力してください。Markdownブロック(\`\`\`json)などは含めず、純粋なJSON文字列のみを返してください。
{
  "menus": [
    {
      "day": 1,
      "meals": [
        {
          "type": "朝食",
          "recipeName": "料理名",
          "caloriesPerPerson": "一人あたりのカロリー(kcal)",
          "pfc": "一人あたりのPFCバランス（例: P:15g F:10g C:40g）",
          "timeRequired": "調理時間（例: 10分）",
          "ingredients": ["材料1", "材料2"],
          "steps": ["手順1", "手順2"]
        }
      ]
    }
  ],
  "shoppingList": [
    {
      "item": "買うべき食材名",
      "amount": "必要な量"
    }
  ]
}

※冷蔵庫にある食材は可能な限り「買い出しリスト」から除外してください。
`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                    temperature: 0.7,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const textResponse = data.candidates[0].content.parts[0].text;
        
        generatedData = JSON.parse(textResponse);
        
        loadingSection.classList.add('hidden');
        renderResults(generatedData);
        resultSection.classList.remove('hidden');

        // Remove param from URL if it was a fresh generation
        window.history.pushState({}, '', window.location.pathname);

    } catch (error) {
        console.error(error);
        loadingSection.classList.add('hidden');
        errorSection.classList.remove('hidden');
        errorMessage.textContent = '献立の生成に失敗しました。APIキーが正しいか、または一時的なエラーの可能性があります。詳細: ' + error.message;
    }
});

// --- Render Results ---
function renderResults(data) {
    menuContainer.innerHTML = '';
    shoppingListContainer.innerHTML = '';

    // Render Menus
    data.menus.forEach(dayInfo => {
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        
        let html = `<div class="day-header">Day ${dayInfo.day}</div>`;
        
        dayInfo.meals.forEach(meal => {
            html += `
            <div class="meal-section">
                <div class="meal-title">${meal.type}</div>
                <div class="recipe-title">${meal.recipeName}</div>
                <div class="recipe-meta">
                    <span title="調理時間"><i data-lucide="clock"></i> ${meal.timeRequired}</span>
                    <span title="カロリー (1人あたり)"><i data-lucide="flame"></i> ${meal.caloriesPerPerson}</span>
                    <span title="PFCバランス"><i data-lucide="activity"></i> ${meal.pfc}</span>
                </div>
                <div class="recipe-ingredients">
                    <strong>材料:</strong> ${meal.ingredients.join('、')}
                </div>
                <div class="recipe-steps">
                    <strong>作り方:</strong>
                    <ol>
                        ${meal.steps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>
            </div>`;
        });
        
        dayCard.innerHTML = html;
        menuContainer.appendChild(dayCard);
    });

    // Render Shopping List
    if (data.shoppingList && data.shoppingList.length > 0) {
        data.shoppingList.forEach((item, i) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" id="shop-${i}">
                <label for="shop-${i}" style="color: inherit; margin: 0; font-size: 1rem;">${item.item} (${item.amount})</label>
            `;
            shoppingListContainer.appendChild(li);
        });
    } else {
        shoppingListContainer.innerHTML = '<li>追加の買い出しは不要です！</li>';
    }

    lucide.createIcons();
}

// --- Tabs ---
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.add('hidden'));
        
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    });
});

// --- Actions ---
errorBackBtn.addEventListener('click', () => {
    errorSection.classList.add('hidden');
    formSection.classList.remove('hidden');
});

resetBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    formSection.classList.remove('hidden');
    generatedData = null;
    window.history.pushState({}, '', window.location.pathname);
});

shareBtn.addEventListener('click', () => {
    if (!generatedData) return;
    
    // Compress JSON string and encode for URL
    const jsonString = JSON.stringify(generatedData);
    const compressed = LZString.compressToEncodedURIComponent(jsonString);
    
    const url = new URL(window.location.href);
    url.searchParams.set('data', compressed);
    
    navigator.clipboard.writeText(url.toString()).then(() => {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    });
});

// Initialize app
init();
