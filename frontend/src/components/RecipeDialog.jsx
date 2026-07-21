import { useState, useEffect } from 'react';
import {
    Alert, AlertDescription, AlertIcon, AlertTitle,
    Box, Button, Collapse, Divider, FormControl, FormHelperText, FormLabel, HStack, Input, Link,
    Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
    Select, Stack, Text, Textarea, useToast,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';
import IngredientRows from './IngredientRows';

const EMPTY = {
    name: '', servings: '', sourceUrl: '', description: '', instructions: '',
    groups: [{ name: '', ingredients: [] }],
    mealId: '', cookbookId: '', extendedData: null,
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSimilar(a, b) {
    const al = a.toLowerCase().trim(), bl = b.toLowerCase().trim();
    return al === bl || al.includes(bl) || bl.includes(al);
}

function groupsFromData(extendedData, flatIngredients) {
    try {
        const ext = extendedData ? JSON.parse(extendedData) : null;
        if (ext?.ingredientGroups?.length > 0) {
            return ext.ingredientGroups.map(g => ({
                name: g.name || '',
                ingredients: g.ingredients || g.items || [],
            }));
        }
    } catch {}
    return [{ name: '', ingredients: flatIngredients || [] }];
}

function RecipeDialog({ isOpen, onClose, editRecipe, meals, cookbooks, onSaved, onCookbookCreated, onMealCreated }) {
    const isEdit = !!editRecipe;
    const [form, setForm] = useState(EMPTY);
    const [addingCookbook, setAddingCookbook] = useState(false);
    const [newCookbookName, setNewCookbookName] = useState('');
    const [savingCookbook, setSavingCookbook] = useState(false);
    const [loading, setLoading] = useState(false);
    const [bulkGroupIdx, setBulkGroupIdx] = useState(null);
    const [bulkText, setBulkText] = useState('');
    const [importUrl, setImportUrl] = useState('');
    const [importing, setImporting] = useState(false);
    const [importAlert, setImportAlert] = useState(null);
    const [creatingMeal, setCreatingMeal] = useState(false);
    const [mealWarning, setMealWarning] = useState(null);
    const [justCreatedMeal, setJustCreatedMeal] = useState(null);
    const [planDate, setPlanDate] = useState('');
    const [planSaving, setPlanSaving] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (!isOpen) return;
        setAddingCookbook(false);
        setNewCookbookName('');
        setBulkGroupIdx(null);
        setBulkText('');
        setImportUrl(isEdit && editRecipe.sourceUrl ? editRecipe.sourceUrl : '');
        setImportAlert(null);
        setCreatingMeal(false);
        setMealWarning(null);
        setJustCreatedMeal(null);
        setPlanDate('');
        setPlanSaving(false);
        if (isEdit) {
            let desc = '';
            try { desc = (editRecipe.extendedData ? JSON.parse(editRecipe.extendedData) : {}).description || ''; } catch {}
            setForm({
                name: editRecipe.name || '',
                servings: editRecipe.servings ?? '',
                sourceUrl: editRecipe.sourceUrl || '',
                description: desc,
                instructions: editRecipe.instructions || '',
                groups: groupsFromData(editRecipe.extendedData, editRecipe.ingredients),
                mealId: editRecipe.mealId ?? '',
                cookbookId: editRecipe.cookbookId ?? '',
                extendedData: editRecipe.extendedData ?? null,
            });
        } else {
            setForm(EMPTY);
        }
    }, [isOpen, editRecipe, isEdit]);

    const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const addGroup = () => setForm(f => ({ ...f, groups: [...f.groups, { name: '', ingredients: [] }] }));
    const removeGroup = (gi) => setForm(f => ({ ...f, groups: f.groups.filter((_, i) => i !== gi) }));
    const updateGroupName = (gi, name) => setForm(f => ({
        ...f, groups: f.groups.map((g, i) => i === gi ? { ...g, name } : g),
    }));
    const updateGroupIngredients = (gi, ingredients) => setForm(f => ({
        ...f, groups: f.groups.map((g, i) => i === gi ? { ...g, ingredients } : g),
    }));

    const applyBulk = (gi) => {
        const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return;
        setForm(f => ({
            ...f,
            groups: f.groups.map((g, i) => i === gi
                ? { ...g, ingredients: [...g.ingredients, ...lines] }
                : g),
        }));
        setBulkText('');
        setBulkGroupIdx(null);
    };

    const handleCreateCookbook = async () => {
        if (!newCookbookName.trim()) return;
        setSavingCookbook(true);
        try {
            const r = await authFetch('/api/cookbooks', {
                method: 'POST',
                body: JSON.stringify({ name: newCookbookName.trim() }),
            });
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                let msg = text;
                try { msg = JSON.parse(text).message || text; } catch { /* raw */ }
                toast({ title: 'Could not create cookbook', description: msg, status: 'error', duration: 4000, isClosable: true });
                return;
            }
            const saved = await r.json();
            onCookbookCreated(saved);
            setForm(f => ({ ...f, cookbookId: String(saved.id) }));
            setNewCookbookName('');
            setAddingCookbook(false);
        } catch {
            toast({ title: 'Could not create cookbook', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setSavingCookbook(false);
        }
    };

    const handleCreateAsMeal = async (force = false) => {
        if (!form.name.trim()) return;
        if (!force) {
            const similar = meals.find(m => isSimilar(m.name, form.name.trim()));
            if (similar) {
                setMealWarning(`A meal named "${similar.name}" already exists.`);
                return;
            }
        }
        setMealWarning(null);
        setCreatingMeal(true);
        try {
            const r = await authFetch('/api/meals', {
                method: 'POST',
                body: JSON.stringify({ name: form.name.trim() }),
            });
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                let msg = text;
                try { msg = JSON.parse(text).message || text; } catch { /* raw */ }
                toast({ title: 'Could not create meal', description: msg, status: 'error', duration: 4000, isClosable: true });
                return;
            }
            const created = await r.json();
            onMealCreated(created);
            setForm(f => ({ ...f, mealId: String(created.id) }));
            setJustCreatedMeal(created);
            setPlanDate(todayStr());
        } catch {
            toast({ title: 'Could not create meal', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setCreatingMeal(false);
        }
    };

    const handleAddToPlanner = async () => {
        if (!planDate || !justCreatedMeal) return;
        const d = new Date(planDate + 'T00:00:00');
        const dayOfWeek = DAY_NAMES[d.getDay()];
        const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        setPlanSaving(true);
        try {
            const r = await authFetch('/api/menus', {
                method: 'POST',
                body: JSON.stringify({
                    mealDate: planDate,
                    dayOfWeek,
                    mealName: justCreatedMeal.name,
                    confirmed: false,
                    leftover: false,
                    leftoverFromDate: null,
                    recipeLink: null,
                    notes: null,
                    minTemp: null,
                    maxTemp: null,
                    seasons: [],
                }),
            });
            if (!r.ok) throw new Error();
            toast({ title: `Added to planner for ${dateLabel}`, status: 'success', duration: 3000, isClosable: true });
            setJustCreatedMeal(null);
        } catch {
            toast({ title: 'Failed to add to planner', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setPlanSaving(false);
        }
    };

    const handleImport = async () => {
        if (!importUrl.trim()) return;
        setImporting(true);
        setImportAlert(null);
        try {
            const r = await authFetch(`/api/recipes/import?url=${encodeURIComponent(importUrl.trim())}`);
            const data = await r.json();
            if (!r.ok) {
                setImportAlert({ status: 'error', message: data.message, suggestion: data.suggestion });
                return;
            }
            const importedDesc = (() => { try { return (data.extendedData ? JSON.parse(data.extendedData) : {}).description || ''; } catch { return ''; } })();
            setForm(f => ({
                ...f,
                name: data.name || f.name,
                servings: data.servings != null ? String(data.servings) : f.servings,
                sourceUrl: data.sourceUrl || importUrl.trim(),
                description: importedDesc || f.description,
                instructions: data.instructions || f.instructions,
                groups: groupsFromData(data.extendedData, data.ingredients),
                extendedData: data.extendedData ?? f.extendedData,
            }));
            if (data.warning) {
                setImportAlert({ status: 'warning', message: data.warningMessage, suggestion: data.warningSuggestion });
            } else {
                setImportAlert({ status: 'success', message: 'Recipe imported — review the fields below and save when ready.' });
            }
        } catch {
            setImportAlert({ status: 'error', message: 'Could not reach the server.', suggestion: 'Check your connection and try again.' });
        } finally {
            setImporting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setLoading(true);
        try {
            const flatIngredients = form.groups.flatMap(g => g.ingredients).filter(i => i.trim());
            const hasGroups = form.groups.length >= 2 || form.groups.some(g => g.name.trim());
            let newExtendedData = null;
            try {
                const extData = form.extendedData ? JSON.parse(form.extendedData) : {};
                if (form.description.trim()) {
                    extData.description = form.description.trim();
                } else {
                    delete extData.description;
                }
                if (hasGroups) {
                    extData.ingredientGroups = form.groups
                        .filter(g => g.ingredients.some(i => i.trim()))
                        .map(g => ({ name: g.name.trim(), ingredients: g.ingredients.filter(i => i.trim()) }));
                } else {
                    delete extData.ingredientGroups;
                }
                newExtendedData = Object.keys(extData).length > 0 ? JSON.stringify(extData) : null;
            } catch { newExtendedData = form.extendedData; }

            const url = isEdit ? `/api/recipes/${editRecipe.id}` : '/api/recipes';
            const method = isEdit ? 'PUT' : 'POST';
            const r = await authFetch(url, {
                method,
                body: JSON.stringify({
                    name: form.name.trim(),
                    servings: form.servings !== '' ? Number(form.servings) : null,
                    sourceUrl: form.sourceUrl.trim() || null,
                    instructions: form.instructions || null,
                    ingredients: flatIngredients,
                    mealId: form.mealId !== '' ? Number(form.mealId) : null,
                    cookbookId: form.cookbookId !== '' ? Number(form.cookbookId) : null,
                    extendedData: newExtendedData,
                }),
            });
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                let msg = text;
                try { msg = JSON.parse(text).message || text; } catch { /* raw */ }
                toast({ title: 'Save failed', description: msg || undefined, status: 'error', duration: 4000, isClosable: true });
                return;
            }
            const saved = await r.json();
            onSaved(saved);
            onClose();
        } catch {
            toast({ title: 'Save failed', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader fontSize="md">{isEdit ? 'Edit recipe' : 'Add recipe'}</ModalHeader>
                <ModalCloseButton />
                <form onSubmit={handleSubmit}>
                    <ModalBody>
                        <Box bg="blue.50" borderRadius="md" p={3} mb={4}>
                            <FormLabel fontSize="sm" mb={2} color="blue.700">Import from URL — optional</FormLabel>
                            <HStack>
                                <Input
                                    size="sm"
                                    placeholder="https://somecookingsite.com/recipe/..."
                                    value={importUrl}
                                    onChange={e => { setImportUrl(e.target.value); setImportAlert(null); }}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleImport(); } }}
                                    isDisabled={importing}
                                    bg="white"
                                />
                                <Button
                                    size="sm"
                                    colorScheme="blue"
                                    onClick={handleImport}
                                    isLoading={importing}
                                    isDisabled={!importUrl.trim()}
                                    flexShrink={0}
                                >
                                    Import
                                </Button>
                            </HStack>
                            {importAlert && (
                                <Alert status={importAlert.status} borderRadius="md" mt={2} py={2} px={3}
                                       flexDirection="column" alignItems="flex-start">
                                    <HStack>
                                        <AlertIcon />
                                        <AlertTitle fontSize="sm">{importAlert.message}</AlertTitle>
                                    </HStack>
                                    {importAlert.suggestion && (
                                        <AlertDescription fontSize="xs" ml={6} mt={1}>
                                            {importAlert.suggestion}
                                        </AlertDescription>
                                    )}
                                </Alert>
                            )}
                        </Box>
                        <Divider mb={4} />

                        <Stack spacing={4}>
                            <FormControl isRequired>
                                <FormLabel>Recipe Name</FormLabel>
                                <Input name="name" value={form.name} onChange={handleChange} autoFocus />
                            </FormControl>

                            <FormControl>
                                <FormLabel fontSize="sm">Source URL — optional</FormLabel>
                                <Input name="sourceUrl" value={form.sourceUrl} onChange={handleChange} placeholder="https://…" size="sm" />
                            </FormControl>

                            <FormControl>
                                <FormLabel fontSize="sm">Cookbook — optional</FormLabel>
                                {addingCookbook ? (
                                    <HStack>
                                        <Input
                                            size="sm"
                                            placeholder="Cookbook name…"
                                            value={newCookbookName}
                                            onChange={e => setNewCookbookName(e.target.value)}
                                            autoFocus
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCookbook(); } if (e.key === 'Escape') setAddingCookbook(false); }}
                                        />
                                        <Button size="sm" colorScheme="green" onClick={handleCreateCookbook} isLoading={savingCookbook} flexShrink={0}>
                                            Create
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setAddingCookbook(false)} flexShrink={0}>
                                            Cancel
                                        </Button>
                                    </HStack>
                                ) : (
                                    <HStack>
                                        <Select
                                            name="cookbookId"
                                            value={form.cookbookId}
                                            onChange={handleChange}
                                            size="sm"
                                            placeholder="No cookbook"
                                        >
                                            {cookbooks.map(cb => (
                                                <option key={cb.id} value={cb.id}>
                                                    {cb.name}{cb.global ? ' ✦' : ''}
                                                </option>
                                            ))}
                                        </Select>
                                        <Button size="sm" variant="outline" onClick={() => setAddingCookbook(true)} flexShrink={0} title="Add new cookbook">
                                            +
                                        </Button>
                                    </HStack>
                                )}
                                <FormHelperText fontSize="xs" mt={1}>✦ = global cookbook</FormHelperText>
                            </FormControl>

                            <FormControl>
                                <FormLabel fontSize="sm">Servings</FormLabel>
                                <Input
                                    type="number"
                                    name="servings"
                                    value={form.servings}
                                    onChange={handleChange}
                                    placeholder="e.g. 4"
                                    size="sm"
                                    w="120px"
                                />
                            </FormControl>

                            <FormControl>
                                <FormLabel fontSize="sm">Description — optional</FormLabel>
                                <Textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="Brief description of the dish…"
                                    rows={2}
                                    resize="vertical"
                                    size="sm"
                                />
                            </FormControl>

                            <FormControl>
                                <HStack justify="space-between" mb={1}>
                                    <FormLabel fontSize="sm" mb={0}>Linked meal — optional</FormLabel>
                                    {form.mealId === '' && form.name.trim() && !mealWarning && (
                                        <Button
                                            size="xs"
                                            colorScheme="teal"
                                            variant="outline"
                                            isLoading={creatingMeal}
                                            onClick={() => handleCreateAsMeal(false)}
                                        >
                                            + Create as meal
                                        </Button>
                                    )}
                                </HStack>
                                <FormHelperText fontSize="xs" mt={0} mb={2}>
                                    Links this recipe to a meal so it appears in the planner.
                                </FormHelperText>
                                <Select
                                    name="mealId"
                                    value={form.mealId}
                                    onChange={handleChange}
                                    size="sm"
                                    placeholder="No meal linked"
                                >
                                    {meals.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </Select>

                                {mealWarning && (
                                    <Box mt={2} p={2} bg="orange.50" borderRadius="md">
                                        <Text fontSize="xs" color="orange.700" mb={2}>{mealWarning}</Text>
                                        <HStack spacing={2}>
                                            <Button size="xs" colorScheme="orange" isLoading={creatingMeal}
                                                onClick={() => handleCreateAsMeal(true)}>Create anyway</Button>
                                            <Button size="xs" variant="ghost" onClick={() => setMealWarning(null)}>Cancel</Button>
                                        </HStack>
                                    </Box>
                                )}

                                {justCreatedMeal && (
                                    <Box mt={3} p={3} bg="teal.50" borderRadius="md">
                                        <Text fontSize="xs" color="teal.700" fontWeight="medium" mb={2}>
                                            ✓ "{justCreatedMeal.name}" added to meal library
                                        </Text>
                                        <Text fontSize="xs" color="teal.600" mb={2}>Add to planner?</Text>
                                        <HStack>
                                            <Input
                                                type="date"
                                                size="sm"
                                                value={planDate}
                                                onChange={e => setPlanDate(e.target.value)}
                                            />
                                            <Button size="sm" colorScheme="teal" isLoading={planSaving}
                                                isDisabled={!planDate} onClick={handleAddToPlanner}>
                                                Add
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setJustCreatedMeal(null)}>
                                                Skip
                                            </Button>
                                        </HStack>
                                    </Box>
                                )}
                            </FormControl>

                            <FormControl>
                                <FormLabel fontSize="sm" mb={2}>Ingredients</FormLabel>
                                {form.groups.map((group, gi) => (
                                    <Box key={gi} mb={gi < form.groups.length - 1 ? 4 : 2}>
                                        <HStack mb={1} spacing={2}>
                                            <Input
                                                size="xs"
                                                variant="flushed"
                                                placeholder={form.groups.length > 1 ? `Group ${gi + 1} name, e.g. For the sauce` : 'Section name — optional'}
                                                value={group.name}
                                                onChange={e => updateGroupName(gi, e.target.value)}
                                                fontWeight={group.name ? 'medium' : 'normal'}
                                                color={group.name ? 'gray.700' : 'gray.400'}
                                            />
                                            <Link
                                                fontSize="xs"
                                                color="purple.500"
                                                cursor="pointer"
                                                flexShrink={0}
                                                onClick={() => {
                                                    if (bulkGroupIdx === gi) { setBulkGroupIdx(null); setBulkText(''); }
                                                    else { setBulkGroupIdx(gi); setBulkText(''); }
                                                }}
                                            >
                                                {bulkGroupIdx === gi ? 'Cancel' : 'Paste list'}
                                            </Link>
                                            {form.groups.length > 1 && (
                                                <Button size="xs" variant="ghost" colorScheme="red" flexShrink={0}
                                                    onClick={() => { removeGroup(gi); if (bulkGroupIdx === gi) setBulkGroupIdx(null); }}
                                                    px={1}>
                                                    ×
                                                </Button>
                                            )}
                                        </HStack>
                                        <Collapse in={bulkGroupIdx === gi} animateOpacity>
                                            <Box mb={2}>
                                                <Textarea
                                                    size="sm"
                                                    placeholder={"1 cup flour\n2 eggs\n1/2 tsp salt\n…"}
                                                    value={bulkText}
                                                    onChange={e => setBulkText(e.target.value)}
                                                    rows={4}
                                                    resize="vertical"
                                                    mb={2}
                                                />
                                                <Button
                                                    size="xs"
                                                    colorScheme="purple"
                                                    onClick={() => applyBulk(gi)}
                                                    isDisabled={!bulkText.trim()}
                                                >
                                                    Add {bulkText.split('\n').filter(l => l.trim()).length || ''} ingredients
                                                </Button>
                                            </Box>
                                        </Collapse>
                                        <IngredientRows
                                            value={group.ingredients}
                                            onChange={ings => updateGroupIngredients(gi, ings)}
                                            suggestionsUrl="/api/ingredients"
                                        />
                                    </Box>
                                ))}
                                <Button size="xs" variant="outline" colorScheme="purple" mt={1} onClick={addGroup}>
                                    + Add ingredient group
                                </Button>
                            </FormControl>

                            <FormControl>
                                <FormLabel fontSize="sm">Instructions</FormLabel>
                                <Textarea
                                    name="instructions"
                                    value={form.instructions}
                                    onChange={handleChange}
                                    placeholder="Step-by-step instructions…"
                                    rows={6}
                                    resize="vertical"
                                    size="sm"
                                />
                            </FormControl>
                        </Stack>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
                        <Button type="submit" colorScheme="green" isLoading={loading}>
                            {isEdit ? 'Save changes' : 'Add recipe'}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
}

export default RecipeDialog;
