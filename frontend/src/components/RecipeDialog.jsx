import { useState, useEffect } from 'react';
import {
    Alert, AlertDescription, AlertIcon, AlertTitle,
    Box, Button, Collapse, Divider, FormControl, FormHelperText, FormLabel, HStack, Input, Link,
    Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
    Select, Stack, Textarea, useToast,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';
import IngredientRows from './IngredientRows';

const EMPTY = { name: '', servings: '', sourceUrl: '', instructions: '', ingredients: [], mealId: '', cookbookId: '' };

function RecipeDialog({ isOpen, onClose, editRecipe, meals, cookbooks, onSaved, onCookbookCreated }) {
    const isEdit = !!editRecipe;
    const [form, setForm] = useState(EMPTY);
    const [addingCookbook, setAddingCookbook] = useState(false);
    const [newCookbookName, setNewCookbookName] = useState('');
    const [savingCookbook, setSavingCookbook] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [importUrl, setImportUrl] = useState('');
    const [importing, setImporting] = useState(false);
    const [importAlert, setImportAlert] = useState(null);
    const toast = useToast();

    useEffect(() => {
        if (!isOpen) return;
        setAddingCookbook(false);
        setNewCookbookName('');
        setShowBulk(false);
        setBulkText('');
        setImportUrl('');
        setImportAlert(null);
        if (isEdit) {
            setForm({
                name: editRecipe.name || '',
                servings: editRecipe.servings ?? '',
                sourceUrl: editRecipe.sourceUrl || '',
                instructions: editRecipe.instructions || '',
                ingredients: editRecipe.ingredients || [],
                mealId: editRecipe.mealId ?? '',
                cookbookId: editRecipe.cookbookId ?? '',
            });
        } else {
            setForm(EMPTY);
        }
    }, [isOpen, editRecipe, isEdit]);

    const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

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
            setForm(f => ({
                ...f,
                name: data.name || f.name,
                servings: data.servings != null ? String(data.servings) : f.servings,
                sourceUrl: data.sourceUrl || importUrl.trim(),
                instructions: data.instructions || f.instructions,
                ingredients: data.ingredients || f.ingredients,
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
            const url = isEdit ? `/api/recipes/${editRecipe.id}` : '/api/recipes';
            const method = isEdit ? 'PUT' : 'POST';
            const r = await authFetch(url, {
                method,
                body: JSON.stringify({
                    name: form.name.trim(),
                    servings: form.servings !== '' ? Number(form.servings) : null,
                    sourceUrl: form.sourceUrl.trim() || null,
                    instructions: form.instructions || null,
                    ingredients: form.ingredients.filter(i => i.trim()),
                    mealId: form.mealId !== '' ? Number(form.mealId) : null,
                    cookbookId: form.cookbookId !== '' ? Number(form.cookbookId) : null,
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
                                <FormLabel fontSize="sm">Linked meal — optional</FormLabel>
                                <FormHelperText fontSize="xs" mt={0} mb={2}>
                                    Associate this recipe with a meal in your library.
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
                            </FormControl>

                            <FormControl>
                                <HStack justify="space-between" mb={1}>
                                    <FormLabel fontSize="sm" mb={0}>Ingredients</FormLabel>
                                    <Link
                                        fontSize="xs"
                                        color="purple.500"
                                        cursor="pointer"
                                        onClick={() => { setShowBulk(b => !b); setBulkText(''); }}
                                    >
                                        {showBulk ? 'Cancel paste' : 'Paste a list'}
                                    </Link>
                                </HStack>
                                <Collapse in={showBulk} animateOpacity>
                                    <Box mb={2}>
                                        <Textarea
                                            size="sm"
                                            placeholder={"1 cup flour\n2 eggs\n1/2 tsp salt\n…"}
                                            value={bulkText}
                                            onChange={e => setBulkText(e.target.value)}
                                            rows={5}
                                            resize="vertical"
                                            mb={2}
                                        />
                                        <Button
                                            size="xs"
                                            colorScheme="purple"
                                            onClick={() => {
                                                const lines = bulkText
                                                    .split('\n')
                                                    .map(l => l.trim())
                                                    .filter(l => l.length > 0);
                                                if (lines.length === 0) return;
                                                setForm(f => ({ ...f, ingredients: [...f.ingredients, ...lines] }));
                                                setBulkText('');
                                                setShowBulk(false);
                                            }}
                                            isDisabled={!bulkText.trim()}
                                        >
                                            Add {bulkText.split('\n').filter(l => l.trim()).length || ''} ingredients
                                        </Button>
                                    </Box>
                                </Collapse>
                                <IngredientRows
                                    value={form.ingredients}
                                    onChange={ings => setForm(f => ({ ...f, ingredients: ings }))}
                                    suggestionsUrl="/api/ingredients"
                                />
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
