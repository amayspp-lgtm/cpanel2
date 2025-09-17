// api/get-status.js

import { connectToDatabase } from '../utils/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed.' });
  }

  try {
    const db = await connectToDatabase();
    const settingsCollection = db.collection('settings');
    const maintenanceSetting = await settingsCollection.findOne({ settingName: 'maintenanceMode' });

    const maintenanceStatus = {
        enabled: maintenanceSetting ? maintenanceSetting.enabled : false,
        lastUpdated: maintenanceSetting ? maintenanceSetting.lastUpdated : null
    };

    return res.status(200).json({ success: true, maintenanceMode: maintenanceStatus });

  } catch (error) {
    console.error('Error fetching site status:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}