import { COLLECTION_ADDRESS, TONCENTER_API_KEY, TONCENTER_TESTNET_BASE } from '../config';

export async function getOwnedCollectionNfts(address) {
    if (!TONCENTER_API_KEY) {
        throw new Error('TONCENTER_API_KEY is not set. Add VITE_TONCENTER_API_KEY to your environment.');
    }

    const url = `${TONCENTER_TESTNET_BASE}/nft/items?` + new URLSearchParams({
        collection_address: COLLECTION_ADDRESS,
        owner_address: address,
        limit: '1000'
    });

    const res = await fetch(url, {
        headers: { 'X-API-Key': TONCENTER_API_KEY }
    });

    if (!res.ok) {
        throw new Error(`Toncenter error: ${res.status}`);
    }

    const data = await res.json();
    const items = data.nft_items || [];

    return items.map((nft) => {
        const meta = data.metadata?.[nft.address]?.token_info?.[0];
        return {
            address: nft.address,
            name: meta?.name || `Hate Dog #${nft.index}`,
            image: meta?.image || null
        };
    });
}