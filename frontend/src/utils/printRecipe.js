export function printRecipe(recipe, { multiplier } = {}) {
    if (!recipe) return;

    let extData = null;
    if (recipe.extendedData) {
        try { extData = JSON.parse(recipe.extendedData); } catch { /* ignore */ }
    }

    const groups = extData?.ingredientGroups?.length ? extData.ingredientGroups : null;

    function formatDuration(val) {
        if (!val) return null;
        if (!/^PT/i.test(val)) return val;
        const h = val.match(/(\d+)H/i)?.[1];
        const m = val.match(/(\d+)M/i)?.[1];
        const parts = [];
        if (h) parts.push(`${h} hr`);
        if (m) parts.push(`${m} min`);
        return parts.length ? parts.join(' ') : null;
    }

    const prep = formatDuration(extData?.prepTime);
    const cook = formatDuration(extData?.cookTime);
    const total = formatDuration(extData?.totalTime);

    const metaItems = [];
    if (recipe.servings != null) metaItems.push(`Serves ${recipe.servings}`);
    if (prep) metaItems.push(`Prep: ${prep}`);
    if (cook) metaItems.push(`Cook: ${cook}`);
    if (total) metaItems.push(`Total: ${total}`);

    const rows = [];

    if (recipe.cookbookName) {
        rows.push(`<p class="meta">${recipe.cookbookName}</p>`);
    }
    if (recipe.sourceUrl) {
        rows.push(`<p class="meta"><a href="${recipe.sourceUrl}">${recipe.sourceUrl}</a></p>`);
    }
    if (metaItems.length) {
        rows.push(`<p class="meta">${metaItems.join(' · ')}</p>`);
    }
    if (extData?.description) {
        rows.push(`<p class="desc">${extData.description}</p>`);
    }

    const hasIngredients = groups || recipe.ingredients?.length;
    if (hasIngredients) {
        rows.push('<h2>Ingredients</h2>');
        if (multiplier) {
            rows.push(`<p class="scale-note">Scaled × ${multiplier} (multiply each amount by ${multiplier})</p>`);
        }
        if (groups) {
            for (const g of groups) {
                if (g.name) rows.push(`<h3>${g.name}</h3>`);
                rows.push('<ul>');
                for (const item of (g.ingredients || g.items || [])) {
                    rows.push(`<li>${item}</li>`);
                }
                rows.push('</ul>');
            }
        } else {
            rows.push('<ul>');
            for (const ing of recipe.ingredients) {
                rows.push(`<li>${ing}</li>`);
            }
            rows.push('</ul>');
        }
    }

    if (recipe.instructions) {
        rows.push('<h2>Instructions</h2>');
        rows.push(`<p class="instructions">${recipe.instructions.replace(/\n/g, '<br>')}</p>`);
    }

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${recipe.name}</title><style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 32px; font-size: 14px; color: #222; max-width: 680px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .06em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin: 20px 0 8px; }
        h3 { font-size: 13px; color: #666; margin: 12px 0 4px; }
        ul { margin: 0 0 8px 0; padding-left: 20px; }
        li { margin: 3px 0; }
        .meta { color: #666; font-size: 13px; margin: 2px 0; }
        .meta a { color: #3182ce; }
        .desc { color: #555; font-style: italic; margin: 8px 0; }
        .scale-note { color: #6b46c1; font-size: 12px; margin-bottom: 8px; }
        .instructions { white-space: pre-wrap; line-height: 1.6; }
    </style></head><body>
        <h1>${recipe.name}</h1>
        ${rows.join('\n')}
    </body></html>`);
    win.document.close();
    win.print();
}
