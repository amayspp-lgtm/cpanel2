// api/get-server-status.js

import fetch from 'node-fetch';
import { connectToDatabase } from '../utils/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed.' });
  }

  try {
    const db = await connectToDatabase();
    const configCollection = db.collection('panelConfigs');
    const publicConfig = await configCollection.findOne({ panelType: 'public' });
    const privateConfig = await configCollection.findOne({ panelType: 'private' });

    if (!publicConfig && !privateConfig) {
      return res.status(404).json({ success: false, message: 'Server configurations not found in database.' });
    }

    const configs = [];
    if (publicConfig) configs.push({ ...publicConfig, panelType: 'public' });
    if (privateConfig) configs.push({ ...privateConfig, panelType: 'private' });

    const allServersStatus = [];

    for (const config of configs) {
      if (!config.domain || !config.ptla) {
        console.warn(`[Get Status] Missing domain or ptla for ${config.panelType} panel. Skipping.`);
        continue;
      }

      const pteroApiUrl = `https://${config.domain}/api/application/servers`;
      const response = await fetch(pteroApiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.ptla}`,
          'Content-Type': 'application/json',
          'Accept': 'Application/vnd.pterodactyl.v1+json',
        }
      });
      const data = await response.json();

      if (response.ok) {
        allServersStatus.push({
          panelType: config.panelType,
          total_servers: data.meta.pagination.total,
          details: data.data.map(server => ({
            id: server.attributes.id,
            uuid: server.attributes.uuid,
            name: server.attributes.name,
            node: server.attributes.node,
            limits: server.attributes.limits
          }))
        });
      } else {
        console.error(`Error fetching servers for ${config.panelType} panel:`, data);
      }
    }

    return res.status(200).json({ success: true, servers: allServersStatus });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error.' });
  }
}