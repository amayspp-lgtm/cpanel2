// api/get-node-status.js

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

    const allNodesStatus = [];

    for (const config of configs) {
      if (!config.domain || !config.ptla) {
        console.warn(`[Get Node Status] Missing domain or ptla for ${config.panelType} panel. Skipping.`);
        continue;
      }

      const pteroApiUrl = `https://${config.domain}/api/application/nodes`;
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
        allNodesStatus.push({
          panelType: config.panelType,
          total_nodes: data.meta.pagination.total,
          details: data.data.map(node => ({
            id: node.attributes.id,
            name: node.attributes.name,
            location_id: node.attributes.location_id,
            memory: node.attributes.memory,
            allocated_memory: node.attributes.allocated_memory,
            disk: node.attributes.disk,
            allocated_disk: node.attributes.allocated_disk,
            cpu: node.attributes.cpu,
            allocated_cpu: node.attributes.allocated_cpu
          }))
        });
      } else {
        console.error(`Error fetching nodes for ${config.panelType} panel:`, data);
      }
    }

    return res.status(200).json({ success: true, nodes: allNodesStatus });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error.' });
  }
}