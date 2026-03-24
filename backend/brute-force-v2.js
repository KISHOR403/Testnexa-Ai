async function testAggressive() {
    const prefixes = ['AIzaSy'];
    const part1 = ['B8q58ow', 'B8g58ow', 'B8qS8ow'];
    const part2 = ['AAEno', 'AAEn0'];
    const part3 = ['AZB3', 'AZ83', 'AZB8', 'AZBB'];
    const sep = ['_'];
    const part4 = ['JEcwZ8', 'JEcvZ8'];
    const part5 = ['EnBvpM', 'EmBvpM'];
    const suffixes = ['1IXQ', '1lXQ', 'lIXQ', 'llXQ', '11XQ', 'IIXQ'];

    console.log("Starting aggressive brute force...");

    for (const p1 of part1) {
        for (const p2 of part2) {
            for (const p3 of part3) {
                for (const p4 of part4) {
                    for (const p5 of part5) {
                        for (const s of suffixes) {
                            const key = `AIzaSy${p1}${p2}${p3}_${p4}${p5}${s}`;
                            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

                            try {
                                const response = await fetch(url, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] })
                                });

                                if (response.ok) {
                                    console.log(`\n\n✅✅✅ WORKING KEY FOUND: ${key}`);
                                    return;
                                }
                            } catch (e) { }
                        }
                    }
                }
            }
        }
    }
    console.log("Finished. No working key found.");
}

testAggressive();
