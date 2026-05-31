import { useState, useEffect } from 'react';
import {
    Alert, AlertDescription, AlertIcon, AlertTitle,
    Box, Button, Checkbox, FormControl, FormHelperText, FormLabel,
    HStack, Input, Modal, ModalBody, ModalCloseButton, ModalContent,
    ModalFooter, ModalHeader, ModalOverlay, Stack, Textarea, useToast,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';

function AddMealModal({ isOpen, onClose, onAdded }) {
    const [form, setForm] = useState({ name: '', recipeLink: '', notes: '', shared: false, minTemp: '', maxTemp: '' });
    const [dupWarning, setDupWarning] = useState(null);
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (!isOpen) return;
        setForm({ name: '', recipeLink: '', notes: '', shared: false, minTemp: '', maxTemp: '' });
        setDupWarning(null);
    }, [isOpen]);

    const handleChange = (e) => {
        if (e.target.name === 'name') setDupWarning(null);
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    };

    const doSave = async () => {
        setLoading(true);
        try {
            const r = await authFetch('/api/meals', {
                method: 'POST',
                body: JSON.stringify({
                    ...form,
                    minTemp: form.minTemp !== '' ? Number(form.minTemp) : null,
                    maxTemp: form.maxTemp !== '' ? Number(form.maxTemp) : null,
                }),
            });
            const saved = await r.json();
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
        try {
            const check = await authFetch(`/api/meals/check?name=${encodeURIComponent(form.name.trim())}`);
            const { existsInHousehold, existsShared } = await check.json();
            if (existsInHousehold) { setDupWarning('household'); return; }
            if (existsShared) { setDupWarning('shared'); return; }
        } catch { /* ignore, proceed */ }
        await doSave();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader fontSize="md">Add meal to library</ModalHeader>
                <ModalCloseButton />
                <form onSubmit={handleSubmit}>
                    <ModalBody>
                        <Stack spacing={4}>
                            <FormControl isRequired>
                                <FormLabel>Meal Name</FormLabel>
                                <Input name="name" value={form.name} onChange={handleChange} autoFocus />
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
                        <Button type="submit" colorScheme="green" isLoading={loading}>Add meal</Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
}

export default AddMealModal;
