import { useState, useEffect } from 'react';
import {
    Alert, AlertDescription, AlertIcon, AlertTitle,
    Box, Button, Checkbox, CheckboxGroup, Divider, FormControl, FormHelperText, FormLabel,
    HStack, Input, Modal, ModalBody, ModalCloseButton, ModalContent,
    ModalFooter, ModalHeader, ModalOverlay, Select, Stack, Text, Textarea, useToast,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';
import TagInput from './TagInput';

const EMPTY_FORM = {
    name: '', recipeLink: '', notes: '', shared: false,
    minTemp: '', maxTemp: '', seasons: [],
    sides: [],
    cookbookId: '',
    linkedRecipeId: '',
};

function AddMealModal({ isOpen, onClose, onAdded, editMeal }) {
    const isEdit = !!editMeal;
    const [form, setForm] = useState(EMPTY_FORM);
    const [cookbooks, setCookbooks] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [dupWarning, setDupWarning] = useState(null);
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (!isOpen) return;
        setDupWarning(null);
        if (isEdit) {
            setForm({
                name: editMeal.name || '',
                recipeLink: editMeal.recipeLink || '',
                notes: editMeal.notes || '',
                shared: editMeal.shared ?? false,
                minTemp: editMeal.minTemp ?? '',
                maxTemp: editMeal.maxTemp ?? '',
                seasons: editMeal.seasons || [],
                sides: editMeal.sides || [],
                cookbookId: editMeal.cookbookId != null ? String(editMeal.cookbookId) : '',
                linkedRecipeId: editMeal.recipe?.id != null ? String(editMeal.recipe.id) : '',
            });
        } else {
            setForm(EMPTY_FORM);
        }
    }, [isOpen, editMeal, isEdit]);

    useEffect(() => {
        if (!isOpen) return;
        authFetch('/api/cookbooks').then(r => r.json()).then(setCookbooks).catch(console.error);
        authFetch('/api/recipes').then(r => r.json()).then(setRecipes).catch(console.error);
    }, [isOpen]);

    const handleChange = (e) => {
        if (e.target.name === 'name') setDupWarning(null);
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    };

    const doSave = async () => {
        setLoading(true);
        try {
            const url = isEdit ? `/api/meals/${editMeal.id}` : '/api/meals';
            const method = isEdit ? 'PUT' : 'POST';
            const r = await authFetch(url, {
                method,
                body: JSON.stringify({
                    name: form.name,
                    recipeLink: form.recipeLink,
                    notes: form.notes,
                    shared: form.shared,
                    minTemp: form.minTemp !== '' ? Number(form.minTemp) : null,
                    maxTemp: form.maxTemp !== '' ? Number(form.maxTemp) : null,
                    seasons: form.seasons,
                    sides: form.sides,
                    cookbookId: form.cookbookId !== '' ? Number(form.cookbookId) : null,
                }),
            });
            const saved = await r.json();

            const originalLinkedRecipeId = isEdit && editMeal.recipe?.id != null ? String(editMeal.recipe.id) : '';
            if (form.linkedRecipeId !== originalLinkedRecipeId) {
                try {
                    const recipeId = form.linkedRecipeId ? Number(form.linkedRecipeId) : null;
                    const pr = await authFetch(`/api/meals/${saved.id}/recipe`, {
                        method: 'PATCH',
                        body: JSON.stringify({ recipeId }),
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

            setDupWarning(null);
            onAdded(saved);
            onClose();
        } catch {
            toast({ title: 'Save failed', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isEdit || form.name.trim() !== editMeal.name) {
            try {
                const check = await authFetch(`/api/meals/check?name=${encodeURIComponent(form.name.trim())}`);
                const { existsInHousehold, existsShared } = await check.json();
                if (existsInHousehold && !isEdit) { setDupWarning('household'); return; }
                if (existsShared && !isEdit) { setDupWarning('shared'); return; }
            } catch { /* ignore, proceed */ }
        }
        await doSave();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader fontSize="md">{isEdit ? 'Edit meal' : 'Add meal to library'}</ModalHeader>
                <ModalCloseButton />
                <form onSubmit={handleSubmit}>
                    <ModalBody>
                        <Stack spacing={4}>
                            <FormControl isRequired>
                                <FormLabel>Meal Name</FormLabel>
                                <Input name="name" value={form.name} onChange={handleChange} autoFocus />
                            </FormControl>

                            <FormControl>
                                <FormLabel fontSize="sm">Cookbook — optional</FormLabel>
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
                                <FormHelperText fontSize="xs" mt={1}>✦ = global cookbook</FormHelperText>
                            </FormControl>

                            {dupWarning && (
                                <Alert status="warning" borderRadius="md" flexDirection="column" alignItems="flex-start">
                                    <HStack mb={1}>
                                        <AlertIcon />
                                        <AlertTitle fontSize="sm">"{form.name}" already exists</AlertTitle>
                                    </HStack>
                                    <AlertDescription fontSize="xs" ml={6} mb={3}>
                                        {dupWarning === 'household'
                                            ? "This name is already in your household's meal library."
                                            : 'This name exists in the shared meal library.'}
                                        {' '}Would you like to change the name, or save it as a duplicate?
                                    </AlertDescription>
                                    <HStack ml={6} spacing={2}>
                                        <Button size="xs" variant="outline" onClick={() => setDupWarning(null)}>Change name</Button>
                                        <Button size="xs" colorScheme="orange" onClick={doSave} isLoading={loading}>Save as duplicate</Button>
                                    </HStack>
                                </Alert>
                            )}

                            <FormControl>
                                <FormLabel fontSize="sm">Linked recipe — optional</FormLabel>
                                <Select
                                    size="sm"
                                    value={form.linkedRecipeId}
                                    onChange={e => setForm(f => ({ ...f, linkedRecipeId: e.target.value }))}
                                    placeholder="No recipe linked"
                                >
                                    {recipes.map(rec => (
                                        <option key={rec.id} value={rec.id}>
                                            {rec.name}{rec.cookbookName ? ` — ${rec.cookbookName}` : ''}
                                        </option>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl>
                                <FormLabel>Recipe Link</FormLabel>
                                <Input name="recipeLink" value={form.recipeLink} onChange={handleChange} placeholder="https://…" />
                            </FormControl>
                            <FormControl>
                                <FormLabel>Notes</FormLabel>
                                <Textarea name="notes" value={form.notes} onChange={handleChange} rows={2} resize="vertical" />
                            </FormControl>

                            <Divider />

                            <Box>
                                <Text fontWeight="semibold" fontSize="sm" mb={3}>Sides <Text as="span" fontSize="xs" color="gray.400" fontWeight="normal">— optional</Text></Text>
                                <TagInput
                                    value={form.sides}
                                    onChange={sides => setForm(f => ({ ...f, sides }))}
                                    placeholder="Type a side and press Enter…"
                                    suggestionsUrl="/api/meals/side-suggestions"
                                />
                            </Box>

                            <Divider />

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
                        <Button type="submit" colorScheme="green" isLoading={loading}>
                            {isEdit ? 'Save changes' : 'Add meal'}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
}

export default AddMealModal;
