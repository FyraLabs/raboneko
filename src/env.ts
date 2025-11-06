// HACK: make dotenv a separate module to deal with
// ESM sequencing issues
// 
// Now .env should get loaded before anything else happens

import dotenv from 'dotenv';
import path from 'path';
let dotenvPath = path.join(process.cwd(), '.env');
if (path.parse(process.cwd()).name === 'dist') dotenvPath = path.join(process.cwd(), '..', '.env');

dotenv.config({ path: dotenvPath });
