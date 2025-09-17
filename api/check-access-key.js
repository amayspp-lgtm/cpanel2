// api/check-access-key.js

import { connectToDatabase } from '../utils/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed.' });
  }

  const { accessKey } = req.query;

  if (!accessKey) {
    return res.status(400).json({ status: 'error', message: 'Access Key is required.' });
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection('accessKeys');
    const foundKey = await collection.findOne({ key: accessKey });

    if (!foundKey) {
      return res.status(200).json({ status: 'not-found', message: 'Access Key tidak ditemukan.' });
    }

    if (foundKey.isBanned) {
      const isExpired = !foundKey.banDetails.isPermanent && foundKey.banDetails.expiresAt < new Date();
      if (!isExpired) {
        return res.status(200).json({ status: 'banned', message: 'Access Key sedang di-ban.' });
      } else {
        // Hapus ban yang sudah kedaluwarsa dan kembalikan status aktif
        await collection.updateOne({ key: accessKey }, { $set: { isBanned: false }, $unset: { banDetails: "" } });
        return res.status(200).json({ status: 'active', message: `Access Key aktif, tipe: ${foundKey.panelTypeRestriction}` });
      }
    }
    
    if (!foundKey.isActive) {
      return res.status(200).json({ status: 'inactive', message: 'Access Key tidak aktif.' });
    }

    return res.status(200).json({ status: 'active', message: `Access Key aktif, tipe: ${foundKey.panelTypeRestriction}` });

  } catch (error) {
    console.error('Error checking Access Key:', error);
    return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server.' });
  }
}