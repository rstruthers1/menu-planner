import { useState, useEffect } from 'react';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter,
    ModalBody, ModalCloseButton, Button, Checkbox, FormControl, FormLabel,
    Input, Textarea, Stack, useToast, Collapse,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function MealDetailModal({ isOpen, onClose, dateStr, dayName, entry, mode, onSaved }) {
    const [localDateStr, setLocalDateStr] = useState(dateStr || '');
    const [form, setForm] = useState({ mealName: '', recipeLink: '', notes: '', confirmed: false, leftover: false, leftoverFromDate: '', shared: false });
    const toast = useToast();

    useEffect(() => {
        if (!isOpen) return;
        setLocalDateStr(dateStr || '');
        setForm(mode === 'edit' && entry
            ? { mealName: entry.mealName || '', recipeLink: entry.recipeLink || '', notes: entry.notes || '', confirmed: entry.confirmed ?? false, leftover: entry.leftover ?? false, leftoverFromDate: entry.leftoverFromDate || '', shared: entry.shared ?? false }
            : { mealName: '', recipeLink: '', notes: '', confirmed: false, leftover: false, leftoverFromDate: '', shared: false }
        );
    }, [isOpen, entry, mode, dateStr]);

    const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const effectiveDateStr = mode === 'add' ? localDateStr : dateStr;

    const handleSubmit = async (e) => {
        e.preventDefault();
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
        };
        const url = mode === 'edit' ? `/api/menus/${entry.id}` : '/api/menus';
        const method = mode === 'edit' ? 'PUT' : 'POST';
        try {
            const r = await authFetch(url, {
                method,
                body: JSON.stringify(body),
            });
            const saved = await r.json();
            onSaved(saved);
            onClose();
        } catch {
            toast({ title: 'Save failed', status: 'error', duration: 3000, isClosable: true });
        }
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
                            <FormControl>
                                <FormLabel>Recipe Link</FormLabel>
                                <Input name="recipeLink" value={form.recipeLink} onChange={handleChange} placeholder="https://…" />
                            </FormControl>
                            <FormControl>
                                <FormLabel>Notes</FormLabel>
                                <Textarea name="notes" value={form.notes} onChange={handleChange} rows={2} resize="vertical" />
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
