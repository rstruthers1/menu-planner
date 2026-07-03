export function recipeDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

export function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const { headers = {}, ...rest } = options;
    return fetch(url, {
        ...rest,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
    });
}
