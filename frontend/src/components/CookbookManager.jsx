import { useRef, useState } from 'react';
import {
    Button, Divider, HStack, Input, Modal, ModalBody, ModalCloseButton,
    ModalContent, ModalHeader, ModalOverlay, Text, useToast, VStack,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';

function CookbookManager({ isOpen, onClose, cookbooks, onCreated, onDeleted }) {
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const inputRef = useRef(null);
    const toast = useToast();

    const householdCookbooks = cookbooks.filter(c => !c.global);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setAdding(true);
        try {
            const r = await authFetch('/api/cookbooks', {
                method: 'POST',
                body: JSON.stringify({ name: newName.trim() }),
            });
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                let msg = text;
                try { msg = JSON.parse(text).message || text; } catch { /* raw */ }
                toast({ title: 'Could not create cookbook', description: msg, status: 'error', duration: 4000, isClosable: true });
                return;
            }
            const saved = await r.json();
            onCreated(saved);
            setNewName('');
            inputRef.current?.focus();
        } catch {
            toast({ title: 'Could not create cookbook', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (cb) => {
        try {
            const r = await authFetch(`/api/cookbooks/${cb.id}`, { method: 'DELETE' });
            if (!r.ok) {
                const text = await r.text().catch(() => '');
                let msg = text;
                try { msg = JSON.parse(text).message || text; } catch { /* raw */ }
                toast({ title: 'Delete failed', description: msg, status: 'error', duration: 4000, isClosable: true });
                return;
            }
            onDeleted(cb.id);
        } catch {
            toast({ title: 'Delete failed', status: 'error', duration: 3000, isClosable: true });
        } finally {
            setDeleteConfirmId(null);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader fontSize="md">My Cookbooks</ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={6}>
                    <form onSubmit={handleAdd}>
                        <HStack mb={4}>
                            <Input
                                ref={inputRef}
                                size="sm"
                                placeholder="New cookbook name…"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                            />
                            <Button type="submit" size="sm" colorScheme="green" isLoading={adding} flexShrink={0}>
                                Add
                            </Button>
                        </HStack>
                    </form>

                    <Divider mb={3} />

                    {householdCookbooks.length === 0 && (
                        <Text fontSize="sm" color="gray.400" textAlign="center" py={4}>
                            No cookbooks yet.
                        </Text>
                    )}

                    <VStack align="stretch" spacing={0}>
                        {householdCookbooks.map(cb => (
                            <HStack
                                key={cb.id}
                                py={2}
                                px={1}
                                justify="space-between"
                                borderBottomWidth="1px"
                                borderColor="gray.100"
                                _last={{ borderBottom: 'none' }}
                            >
                                <Text fontSize="sm">{cb.name}</Text>
                                {deleteConfirmId === cb.id ? (
                                    <HStack spacing={1}>
                                        <Text fontSize="xs" color="red.500">Delete?</Text>
                                        <Button size="xs" colorScheme="red" onClick={() => handleDelete(cb)}>Yes</Button>
                                        <Button size="xs" variant="ghost" onClick={() => setDeleteConfirmId(null)}>No</Button>
                                    </HStack>
                                ) : (
                                    <Button size="xs" variant="ghost" colorScheme="red" onClick={() => setDeleteConfirmId(cb.id)}>
                                        Delete
                                    </Button>
                                )}
                            </HStack>
                        ))}
                    </VStack>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

export default CookbookManager;
