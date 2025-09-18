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
      console.error('[Get Node Status] Konfigurasi panel tidak ditemukan di database.');
      return res.status(404).json({ success: false, message: 'Konfigurasi panel tidak ditemukan di database. Harap setel konfigurasi melalui bot Telegram.' });
    }

    const configs = [];
    if (publicConfig) configs.push({ ...publicConfig, panelType: 'public' });
    if (privateConfig) configs.push({ ...privateConfig, panelType: 'private' });

    const allNodesStatus = [];

    for (const config of configs) {
      if (!config.domain || !config.ptla) {
        console.warn(`[Get Node Status] Melewatkan konfigurasi ${config.panelType} karena domain atau PTLA tidak ditemukan.`);
        continue;
      }
      
      const pteroApiUrl = `https://${config.domain}/api/application/nodes`;
      console.log(`[Get Node Status] Mencoba mengambil data node dari URL: ${pteroApiUrl}`);

      try {
        const response = await fetch(pteroApiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.ptla}`,
            'Content-Type': 'application/json',
            'Accept': 'Application/vnd.pterodactyl.v1+json',
          },
        });
        
        console.log(`[Get Node Status] Menerima respons dengan status: ${response.status}`);
        
        const data = await response.json(); // Coba parsing JSON
        console.log(`[Get Node Status] Data respons:`, JSON.stringify(data, null, 2));

        if (response.ok && data.data) {
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
          // Respons berhasil, tapi mungkin ada error di payload JSON
          const errorMessage = data.errors && data.errors[0] ? data.errors[0].detail : `Respons Pterodactyl tidak valid (${response.status})`;
          console.error(`[Get Node Status] Gagal mengambil data node untuk panel ${config.panelType}. Detail error:`, errorMessage);
          allNodesStatus.push({
            panelType: config.panelType,
            error: errorMessage,
          });
        }
      } catch (fetchError) {
        // Kesalahan saat fetch (e.g., malformed JSON)
        console.error(`[Get Node Status] Terjadi kesalahan saat parsing respons Pterodactyl untuk panel ${config.panelType}:`, fetchError);
        allNodesStatus.push({
          panelType: config.panelType,
          error: `Kesalahan saat memproses respons server.`,
        });
      }
    }
    
    if (allNodesStatus.length === 0) {
      return res.status(404).json({ success: false, message: 'Tidak dapat mengambil status dari panel mana pun. Periksa konfigurasi Anda.' });
    }

    return res.status(200).json({ success: true, nodes: allNodesStatus });

  } catch (error) {
    console.error('[Get Node Status] Kesalahan fatal di handler:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error.' });
  }
}
