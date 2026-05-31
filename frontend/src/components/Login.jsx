import { useState } from 'react';
import {
    Box, Button, FormControl, FormLabel, Heading, Input, Text, VStack,
} from '@chakra-ui/react';

function Login({ onLogin }) {
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
            const body = mode === 'login'
                ? { email: form.email, password: form.password }
                : { name: form.name, email: form.email, password: form.password };
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!r.ok) {
                const msg = await r.text();
                setError(msg || 'Something went wrong');
                return;
            }
            const data = await r.json();
            onLogin(data.token, { name: data.name, householdName: data.householdName });
        } catch {
            setError('Could not connect to server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box maxW="360px" mx="auto" mt={16} p={8} borderWidth="1px" borderRadius="lg" shadow="sm">
            <Heading size="md" mb={6}>
                {mode === 'login' ? 'Sign in' : 'Create account'}
            </Heading>
            <form onSubmit={handleSubmit}>
                <VStack spacing={4}>
                    {mode === 'register' && (
                        <FormControl isRequired>
                            <FormLabel>Name</FormLabel>
                            <Input name="name" value={form.name} onChange={handleChange} placeholder="Your first name" autoFocus />
                        </FormControl>
                    )}
                    <FormControl isRequired>
                        <FormLabel>Email</FormLabel>
                        <Input name="email" type="email" value={form.email} onChange={handleChange} autoFocus={mode === 'login'} />
                    </FormControl>
                    <FormControl isRequired>
                        <FormLabel>Password</FormLabel>
                        <Input name="password" type="password" value={form.password} onChange={handleChange} />
                    </FormControl>
                    {error && <Text color="red.500" fontSize="sm" alignSelf="flex-start">{error}</Text>}
                    <Button type="submit" colorScheme="green" width="full" isLoading={loading}>
                        {mode === 'login' ? 'Sign in' : 'Create account'}
                    </Button>
                    <Button
                        variant="link"
                        size="sm"
                        colorScheme="gray"
                        onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
                    >
                        {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
                    </Button>
                </VStack>
            </form>
        </Box>
    );
}

export default Login;
