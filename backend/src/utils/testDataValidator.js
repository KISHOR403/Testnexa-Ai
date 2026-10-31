/**
 * TestNexa AI — Test Data Validation & Parsing Engine
 * Validates, normalizes, and masks JSON, CSV, and Key-Value datasets.
 */

/**
 * Robust CSV parser that correctly handles quoted values containing commas and newlines
 */
function parseCsvRows(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;
    let i = 0;

    while (i < text.length) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                // Escaped double quote
                currentCell += '"';
                i += 2;
                continue;
            }
            insideQuotes = !insideQuotes;
            i++;
            continue;
        }

        if (!insideQuotes && (char === '\r' || char === '\n')) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentRow.push(currentCell.trim());
            // Only push non-empty rows
            if (currentRow.some(c => c.length > 0)) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
            i++;
            continue;
        }

        if (!insideQuotes && char === ',') {
            currentRow.push(currentCell.trim());
            currentCell = '';
            i++;
            continue;
        }

        currentCell += char;
        i++;
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
            rows.push(currentRow);
        }
    }

    return rows;
}

/**
 * Validates JSON content
 */
function validateJson(content) {
    if (content === null || content === undefined || (typeof content === 'string' && !content.trim())) {
        return {
            valid: false,
            error: 'JSON dataset content cannot be empty'
        };
    }

    let parsed;
    if (typeof content === 'string') {
        try {
            parsed = JSON.parse(content);
        } catch (err) {
            // Attempt to pinpoint line/column if possible
            const posMatch = err.message.match(/position\s+(\d+)/i);
            let locationInfo = '';
            if (posMatch) {
                const pos = parseInt(posMatch[1], 10);
                const lines = content.slice(0, pos).split('\n');
                locationInfo = ` at line ${lines.length}, column ${lines[lines.length - 1].length + 1}`;
            }
            return {
                valid: false,
                error: `Invalid JSON syntax${locationInfo}: ${err.message}`
            };
        }
    } else {
        parsed = content;
    }

    if (typeof parsed !== 'object' || parsed === null) {
        return {
            valid: false,
            error: 'JSON dataset root must be an Array of records or a JSON Object'
        };
    }

    let records = [];
    let recordCount = 0;

    if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
            return {
                valid: false,
                error: 'JSON array must contain at least one record'
            };
        }
        records = parsed;
        recordCount = parsed.length;
    } else {
        // Single object or key-value dictionary
        const keys = Object.keys(parsed);
        if (keys.length === 0) {
            return {
                valid: false,
                error: 'JSON object cannot be empty'
            };
        }
        records = [parsed];
        recordCount = keys.length;
    }

    return {
        valid: true,
        format: 'json',
        parsed,
        records,
        recordCount
    };
}

/**
 * Validates CSV content
 */
function validateCsv(content) {
    if (!content || typeof content !== 'string' || !content.trim()) {
        return {
            valid: false,
            error: 'CSV dataset content cannot be empty'
        };
    }

    const rows = parseCsvRows(content);
    if (rows.length === 0) {
        return {
            valid: false,
            error: 'CSV contains no rows'
        };
    }

    const headers = rows[0];
    if (!headers || headers.length === 0 || headers.every(h => !h)) {
        return {
            valid: false,
            error: 'CSV header row cannot be empty'
        };
    }

    // Check duplicate headers
    const headerSet = new Set();
    for (const h of headers) {
        if (!h) {
            return {
                valid: false,
                error: 'CSV header columns must not be blank'
            };
        }
        if (headerSet.has(h.toLowerCase())) {
            return {
                valid: false,
                error: `Duplicate CSV column header found: "${h}"`
            };
        }
        headerSet.add(h.toLowerCase());
    }

    if (rows.length < 2) {
        return {
            valid: false,
            error: 'CSV must contain at least one data row beneath the header'
        };
    }

    const expectedCols = headers.length;
    const records = [];

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (row.length !== expectedCols) {
            return {
                valid: false,
                error: `CSV row ${r + 1} has ${row.length} columns, expected ${expectedCols} columns matching header`
            };
        }
        const record = {};
        for (let c = 0; c < expectedCols; c++) {
            record[headers[c]] = row[c];
        }
        records.push(record);
    }

    return {
        valid: true,
        format: 'csv',
        headers,
        records,
        recordCount: records.length
    };
}

/**
 * Validates Key-Value or Environment Variables content
 */
function validateKeyValue(content) {
    if (!content) {
        return {
            valid: false,
            error: 'Environment variables content cannot be empty'
        };
    }

    const records = [];
    const validKeyRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

    if (typeof content === 'string') {
        const lines = content.split('\n');
        for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx].trim();
            if (!line || line.startsWith('#')) continue; // comments or blanks

            const eqIdx = line.indexOf('=');
            if (eqIdx === -1) {
                return {
                    valid: false,
                    error: `Line ${idx + 1} is invalid: must be KEY=VALUE format (missing '=')`
                };
            }

            const key = line.slice(0, eqIdx).trim();
            let value = line.slice(eqIdx + 1).trim();

            if (!validKeyRegex.test(key)) {
                return {
                    valid: false,
                    error: `Line ${idx + 1}: Invalid variable key "${key}". Variable keys must contain only letters, numbers, and underscores, and cannot start with a number.`
                };
            }

            // Strip surrounding quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            const isSensitive = isSensitiveKey(key);
            records.push({ key, value, isSecret: isSensitive });
        }
    } else if (Array.isArray(content)) {
        for (let i = 0; i < content.length; i++) {
            const item = content[i];
            if (!item || typeof item !== 'object' || !item.key) {
                return {
                    valid: false,
                    error: `Item at index ${i} is missing required "key" attribute`
                };
            }
            if (!validKeyRegex.test(item.key)) {
                return {
                    valid: false,
                    error: `Item "${item.key}" has invalid variable key format`
                };
            }
            records.push({
                key: item.key,
                value: String(item.value ?? ''),
                isSecret: Boolean(item.isSecret || isSensitiveKey(item.key))
            });
        }
    } else if (typeof content === 'object') {
        for (const [k, v] of Object.entries(content)) {
            if (!validKeyRegex.test(k)) {
                return {
                    valid: false,
                    error: `Key "${k}" has invalid variable name format`
                };
            }
            records.push({
                key: k,
                value: String(v ?? ''),
                isSecret: isSensitiveKey(k)
            });
        }
    }

    if (records.length === 0) {
        return {
            valid: false,
            error: 'No valid key-value pairs identified'
        };
    }

    return {
        valid: true,
        format: 'key_value',
        records,
        recordCount: records.length
    };
}

/**
 * Checks whether a variable name indicates sensitive credential data
 */
function isSensitiveKey(keyName) {
    if (!keyName) return false;
    const lower = keyName.toLowerCase();
    const sensitivePatterns = [
        'secret', 'password', 'pass', 'token', 'apikey', 'api_key', 'auth',
        'credential', 'private', 'cert', 'ssh', 'bearer', 'client_secret'
    ];
    return sensitivePatterns.some(pat => lower.includes(pat));
}

/**
 * Masks sensitive records in dataset for public responses
 */
function maskDatasetSecrets(dataset) {
    if (!dataset) return dataset;
    const copy = JSON.parse(JSON.stringify(dataset));

    const isEnvOrSecret = copy.category === 'environment_variables' || copy.isSecret;

    if (isEnvOrSecret && Array.isArray(copy.records)) {
        copy.records = copy.records.map(rec => {
            if (rec.isSecret || isSensitiveKey(rec.key)) {
                return {
                    ...rec,
                    value: '••••••••',
                    isMasked: true
                };
            }
            return rec;
        });
    }

    return copy;
}

module.exports = {
    parseCsvRows,
    validateJson,
    validateCsv,
    validateKeyValue,
    isSensitiveKey,
    maskDatasetSecrets
};

