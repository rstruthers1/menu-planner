import { useState, useEffect } from 'react';
import {
    Alert, AlertDescription, AlertIcon, AlertTitle,
    Box, Button, Checkbox, CheckboxGroup, Collapse, FormControl, FormHelperText, FormLabel,
    HStack, Input, Modal, ModalBody, ModalCloseButton, ModalContent,
    ModalFooter, ModalHeader, ModalOverlay, Select, Stack, Text, Textarea, useToast,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EMPTY_FORM = {
    mealName: '', recipeLink: '', notes: '', confirmed: false, leftover: false,
    leftoverFromDate: '', shared: false, minTemp: '', maxTemp: '', seasons: [],
    recipeId: null, cookbookId: '',
};

function MealDetailModal({ isOpen, onClose, dateStr, dayName, entry, mode, onSaved }) {
    const [localDateStr, setLocalDateStr] = useState(dateStr || '');
    const [form, setForm] = useState(EMPTY_FORM);
    const [dupWarning, setDupWarning] = useState(null);
    const [recipes, setRecipes] = useState([]);
    const [cookbooks, setCookbooks] = useState([]);
    const [addingCookbook, setAddingCookbook] = useState(false);
    const [newCookbookName, setNewCookbookName] = useState('');
    const [savingCookbook, setSavingCookbook] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (!isOpen) return;
        setLocalDateStr(dateStr || '');
        setDupWarning(null);
        setAddingCookbook(false);
        setNewCookbookName('');
        setForm(mode === 'edit' && entry
            ? {
                mealName: entry.mealName || '',
                recipeLink: entry.recipeLink || '',
                notes: entry.notes || '',
                confirmed: entry.confirmed ?? false,
                leftover: entry.leftover ?? false,
                leftoverFromDate: entry.leftoverFromDate || '',
                shared: entry.shared ?? false,
                minTemp: entry.minTemp ?? '',
                maxTemp: entry.maxTemp ?? '',
                seasons: entry.seasons || [],
                recipeId: entry.recipeId ?? null,
                cookbookId: entry.cookbookId != null ? String(entry.cookbookId) : '',
            }
            : EMPTY_FORM
        );
    }, [isOpen, entry, mode, dateStr]);

    useEffect(() => {
        if (!isOpen) return;
        authFetch('/api/cookbooks').then(r => r.json()).then(setCookbooks).catch(console.error);
        if (mode === 'edit') {
            authFetch('/api/recipes').then(r => r.json()).then(setRecipes).catch(console.error);
        }
    }, [isOpen, mode]);

    const handleChange = (e) => {
        if (e.target.name === 'mealName') setDupWarning(null);
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));
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
            setCookbooks(prev => [...prev, saved].sort((a, b) => {
                if (a.global !== b.global) return a.global ? 1 : -1;
                return a.name.localeCompare(b.name);
            }));
            setForm(f => ({ ...f, cookbookId: String(saved.id) }));
            setNewCookbookName('');
            setAddingCookbook(false);
        } catch {
            toast({ title: 'Could not create cookbook', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setSavingCookbook(false);
        }
    };

    const effectiveDateStr = mode === 'add' ? localDateStr : dateStr;

    const doSave = async () => {
        const effectiveDayName = mode === 'add' && localDateStr
            ? DAY_NAMES[new Date(localDateStr + 'T00:00:00').getDay()]
            : dayName;
        const body = {
            mealDate: effectiveDateStr,
            dayOfWeek: effectiveDayName,
            mealName: form.mealName,
            recipeLink: form.recipeLink,
            notes: form.notes,
            confirmed: form.confirmed,
            leftover: form.leftover,
            leftoverFromDate: form.leftover ? (form.leftoverFromDate || null) : null,
            shared: form.shared,
            minTemp: form.minTemp !== '' ? Number(form.minTemp) : null,
            maxTemp: form.maxTemp !== '' ? Number(form.maxTemp) : null,
            seasons: form.seasons,
        };
        const url = mode === 'edit' ? `/api/menus/${entry.id}` : '/api/menus';
        const method = mode === 'edit' ? 'PUT' : 'POST';
        try {
            const r = await authFetch(url, { method, body: JSON.stringify(body) });
            const saved = await r.json();
            setDupWarning(null);

            if (saved.mealId) {
                // Patch cookbook if changed
                const originalCookbookId = mode === 'edit' ? (entry?.cookbookId != null ? String(entry.cookbookId) : '') : '';
                if (form.cookbookId !== originalCookbookId) {
                    try {
                        const cookbookId = form.cookbookId !== '' ? Number(form.cookbookId) : null;
                        const pr = await authFetch(`/api/meals/${saved.mealId}/cookbook`, {
                            method: 'PATCH',
                            body: JSON.stringify({ cookbookId }),
                        });
                        if (pr.ok) {
                            const linked = await pr.json();
                            saved.cookbookId = linked.cookbookId ?? null;
                            saved.cookbookName = linked.cookbookName ?? null;
                        }
                    } catch { /* non-fatal */ }
                }

                // Patch recipe if changed (edit mode only)
                const originalRecipeId = entry?.recipeId ?? null;
                const newRecipeId = form.recipeId;
                if (mode === 'edit' && newRecipeId !== originalRecipeId) {
                    try {
                        const pr = await authFetch(`/api/meals/${saved.mealId}/recipe`, {
                            method: 'PATCH',
                            body: JSON.stringify({ recipeId: newRecipeId }),
                        });
                        if (pr.ok) {
                            const linked = await pr.json();
                            saved.recipeId = linked.recipeId || null;
                            saved.recipeName = linked.recipeName || null;
                        } else {
                            const text = await pr.text().catch(() => '');
                            let msg = text;
                            try { msg = JSON.parse(text).message || text; } catch { /* raw */ }
                            toast({ title: 'Could not link recipe', description: msg, status: 'warning', duration: 4000, isClosable: true });
                        }
                    } catch {
                        toast({ title: 'Could not link recipe', status: 'warning', duration: 3000, isClosable: true });
                    }
                }
            }

            onSaved(saved);
            onClose();
        } catch {
            toast({ title: 'Save failed', status: 'error', duration: 3000, isClosable: true });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const nameChanged = !(mode === 'edit' && entry?.mealName === form.mealName.trim());
        if (nameChanged && form.mealName.trim()) {
            try {
                const check = await authFetch(`/api/meals/check?name=${encodeURIComponent(form.mealName.trim())}`);
                const { existsInHousehold, existsShared } = await check.json();
                if (existsInHousehold) { setDupWarning('household'); return; }
                if (existsShared) { setDupWarning('shared'); return; }
            } catch { /* ignore, proceed */ }
        }
        await doSave();
    };

    const displayDate = dateStr
        ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : '';

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader fontSize="md">
                    {mode === 'edit' ? displayDate : 'Add New Meal'}
                </ModalHeader>
                <ModalCloseButton />
                <form onSubmit={handleSubmit}>
                    <ModalBody>
                        <Stack spacing={4}>
                            {mode === 'add' && (
                                <FormControl isRequired>
                                    <FormLabel>Date</FormLabel>
                                    <Input
                                        type="date"
                                        value={localDateStr}
                                        onChange={e => setLocalDateStr(e.target.value)}
                                    />
                                </FormControl>
                            )}
                            <FormControl isRequired>
                                <FormLabel>Meal Name</FormLabel>
                                <Input name="mealName" value={form.mealName} onChange={handleChange} autoFocus />
                            </FormControl>

                            {dupWarning && (
                                <Alert status="warning" borderRadius="md" flexDirection="column" alignItems="flex-start">
                                    <HStack mb={1}>
                                        <AlertIcon />
                                        <AlertTitle fontSize="sm">"{form.mealName}" already exists</AlertTitle>
                                    </HStack>
                                    <AlertDescription fontSize="xs" ml={6} mb={3}>
                                        {dupWarning === 'household'
                                            ? 'This name is already in your household\'s meal library.'
                                            : 'This name exists in the shared meal library.'}
                                        {' '}Would you like to change the name, or save it as a duplicate?
                                    </AlertDescription>
                                    <HStack ml={6} spacing={2}>
                                        <Button size="xs" variant="outline" onClick={() => setDupWarning(null)}>
                                            Change name
                                        </Button>
                                        <Button size="xs" colorScheme="orange" onClick={doSave}>
                                            Save as duplicate
                                        </Button>
                                    </HStack>
                                </Alert>
                            )}

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
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') { e.preventDefault(); handleCreateCookbook(); }
                                                if (e.key === 'Escape') setAddingCookbook(false);
                                            }}
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

                            {mode === 'edit' && (
                                <FormControl>
                                    <FormLabel fontSize="sm">Linked recipe</FormLabel>
                                    <Select
                                        size="sm"
                                        value={form.recipeId ?? ''}
                                        onChange={e => setForm(f => ({ ...f, recipeId: e.target.value ? Number(e.target.value) : null }))}
                                        placeholder="No recipe linked"
                                    >
                                        {recipes.map(rec => (
                                            <option key={rec.id} value={rec.id}>
                                                {rec.name}{rec.cookbookName ? ` — ${rec.cookbookName}` : ''}
                                            </option>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}

                            <FormControl>
                                <FormLabel>Recipe Link</FormLabel>
                                <Input name="recipeLink" value={form.recipeLink} onChange={handleChange} placeholder="https://…" />
                            </FormControl>
                            <FormControl>
                                <FormLabel>Notes</FormLabel>
                                <Textarea name="notes" value={form.notes} onChange={handleChange} rows={2} resize="vertical" />
                            </FormControl>
                            <FormControl>
                                <FormLabel fontSize="sm">Temperature Range (°F) — optional</FormLabel>
                                <HStack>
                                    <Box flex={1}>
                                        <Input
                                            type="number"
                                            name="minTemp"
                                            value={form.minTemp}
                                            onChange={handleChange}
                                            placeholder="Min"
                                            size="sm"
                                        />
                                        <FormHelperText fontSize="xs" mt={1}>Too cold below</FormHelperText>
                                    </Box>
                                    <Box flex={1}>
                                        <Input
                                            type="number"
                                            name="maxTemp"
                                            value={form.maxTemp}
                                            onChange={handleChange}
                                            placeholder="Max"
                                            size="sm"
                                        />
                                        <FormHelperText fontSize="xs" mt={1}>Too hot above</FormHelperText>
                                    </Box>
                                </HStack>
                            </FormControl>
                            <Checkbox
                                isChecked={form.confirmed}
                                onChange={e => setForm(f => ({ ...f, confirmed: e.target.checked }))}
                                colorScheme="green"
                            >
                                Confirmed meal
                            </Checkbox>
                            <Checkbox
                                isChecked={form.leftover}
                                onChange={e => setForm(f => ({ ...f, leftover: e.target.checked, leftoverFromDate: e.target.checked ? f.leftoverFromDate : '' }))}
                                colorScheme="orange"
                            >
                                Leftovers
                            </Checkbox>
                            <Collapse in={form.leftover} animateOpacity>
                                <FormControl pl={6}>
                                    <FormLabel fontSize="sm" color="gray.600">Leftover from (optional)</FormLabel>
                                    <Input
                                        type="date"
                                        size="sm"
                                        value={form.leftoverFromDate}
                                        onChange={e => setForm(f => ({ ...f, leftoverFromDate: e.target.value }))}
                                    />
                                </FormControl>
                            </Collapse>
                            <FormControl>
                                <FormLabel fontSize="sm">Suitable seasons — optional</FormLabel>
                                <Text fontSize="xs" color="gray.500" mb={2}>Leave all unchecked for no restriction.</Text>
                                <CheckboxGroup
                                    value={form.seasons}
                                    onChange={val => setForm(f => ({ ...f, seasons: val }))}
                                    colorScheme="teal"
                                >
                                    <HStack spacing={4}>
                                        <Checkbox value="SPRING">Spring</Checkbox>
                                        <Checkbox value="SUMMER">Summer</Checkbox>
                                        <Checkbox value="FALL">Fall</Checkbox>
                                        <Checkbox value="WINTER">Winter</Checkbox>
                                    </HStack>
                                </CheckboxGroup>
                            </FormControl>
                            <Checkbox
                                isChecked={form.shared}
                                onChange={e => setForm(f => ({ ...f, shared: e.target.checked }))}
                                colorScheme="blue"
                            >
                                Share with all households
                            </Checkbox>
                        </Stack>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
                        <Button type="submit" colorScheme="green">
                            {mode === 'edit' ? 'Save Changes' : 'Add Meal'}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
}

export default MealDetailModal;
