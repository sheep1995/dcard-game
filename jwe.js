require('dotenv').config()
const jose = require('jose')

module.exports = {
    encrypt: async function(){
        // Generate a new key pair for encryption
        const keystore = jose.JWK.createKeyStore();
        const publicKey = await keystore.generate('RSA', 2048, { use: 'enc' });
        const privateKey = await keystore.generate('RSA', 2048, { use: 'enc' });

        // The message to encrypt
        const plaintextMessage = 'This is a secret message';

        // Encrypt the message using the public key
        const encrypted = await jose.JWE.createEncrypt({ format: 'compact' }, { key: publicKey })
            .update(plaintextMessage, 'utf8')
            .final();

        console.log('Encrypted Message:', encrypted);
    },

    decrypt: async function(token){
        let user = {};
        try {
            console.log(process.env.Game_Secret);
            console.log(token);
            const key = Buffer.from(process.env.Game_Secret)
            const { plaintext } = await jose.compactDecrypt(token, key, {
                maxPBES2Count: 100000,
                keyManagementAlgorithms: ['PBES2-HS256+A128KW'],
                contentEncryptionAlgorithms: ['A128CBC-HS256']
            })
            user = new TextDecoder().decode(plaintext)
        } catch (error) {
            console.error(error);
        }
        console.log(user)
        return JSON.parse(user);
    }
}