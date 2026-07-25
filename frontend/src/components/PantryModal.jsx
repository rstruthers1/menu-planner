import { useEffect, useState } from 'react';
import {
    Button, Modal, ModalBody, ModalCloseButton, ModalContent,
    ModalFooter, ModalHeader, ModalOverlay, Spinner, Text,
} from '@chakra-ui/react';
import { authFetch } from '../utils/api';
import IngredientRows from './IngredientRows';

export default function PantryModal({ isOpen, onClose }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        authFetch('/api/pantry')
            .then(r => r.json())
            .then(d => { setItems(d.items || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [isOpen]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const filtered = items.filter(i => i.trim());
            await authFetch('/api/pantry', {
                method: 'PUT',
                body: JSON.stringify({ items: filtered }),
            });
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" scrollBehavior="inside">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader fontSize="md">Pantry — What We Have On Hand</ModalHeader>
                <ModalCloseButton />
                <ModalBody pt={2} pb={4}>
                    <Text fontSize="sm" color="gray.500" mb={3}>
                        Items listed here will be marked "have it" on the shopping list.
                    </Text>
                    {loading
                        ? <Spinner size="sm" />
                        : <IngredientRows
                            value={items}
                            onChange={setItems}
                            suggestionsUrl="/api/ingredients/search"
                          />
                    }
                    <Text fontSize="xs" color="gray.500" mt={3}>
                        Tip: use plain names like "eggs", "olive oil", "garlic" — no quantities needed.
                    </Text>
                </ModalBody>
                <ModalFooter pt={2}>
                    <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
                    <Button colorScheme="teal" onClick={handleSave} isLoading={saving}>
                        Save
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
