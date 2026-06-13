import { useState, useEffect } from 'react';
import {
    Button, FormControl, FormHelperText, FormLabel, Input, Modal, ModalBody,
    ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
    Select, Stack, Textarea, useToast,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';
import IngredientRows from './IngredientRows';

const EMPTY = { name: '', servings: '', instructions: '', ingredients: [], mealId: '' };

function RecipeDialog({ isOpen, onClose, editRecipe, meals, onSaved }) {
    const isEdit = !!editRecipe;
    const [form, setForm] = useState(EMPTY);
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (!isOpen) return;
        if (isEdit) {
            setForm({
                name: editRecipe.name || '',
                servings: editRecipe.servings ?? '',
                instructions: editRecipe.instructions || '',
                ingredients: editRecipe.ingredients || [],
                mealId: editRecipe.mealId ?? '',
            });
        } else {
            setForm(EMPTY);
        }
    }, [isOpen, editRecipe, isEdit]);

    const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

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
                    instructions: form.instructions || null,
                    ingredients: form.ingredients,
                    mealId: form.mealId !== '' ? Number(form.mealId) : null,
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
                        <Stack spacing={4}>
                            <FormControl isRequired>
                                <FormLabel>Recipe Name</FormLabel>
                                <Input name="name" value={form.name} onChange={handleChange} autoFocus />
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
                                <FormLabel fontSize="sm">Ingredients</FormLabel>
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
