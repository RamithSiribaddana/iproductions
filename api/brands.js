import { ObjectId } from 'mongodb';
import { collection, readBody, requireOwner, sendError, validImage } from './_lib.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const items = await collection('brands');
      const documents = await items.find({}).sort({ order: 1, _id: 1 }).toArray();
      return res.status(200).json(documents.map(({ _id, name, image }) => ({
        id: _id.toString(),
        name,
        image: image || null,
      })));
    }

    if (!['POST', 'DELETE', 'PUT'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, DELETE, PUT');
      return res.status(405).json({ error: 'Method not allowed.' });
    }
    if (!await requireOwner(req)) return res.status(403).json({ error: 'Owner access required.' });
    const items = await collection('brands');

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (!body || typeof body.name !== 'string' || !body.name.trim() ||
          body.name.trim().length > 120 || !validImage(body.image)) {
        return res.status(400).json({ error: 'Enter a brand name and a valid image under 2 MB.' });
      }

      const document = { name: body.name.trim(), image: body.image || null, order: -Date.now() };
      const result = await items.insertOne(document);
      return res.status(201).json({ id: result.insertedId.toString(), ...document });
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query?.id === 'string' ? req.query.id : '';
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'A valid item ID is required.' });
      await items.deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true });
    }

    const body = await readBody(req);
    if (!body || !Array.isArray(body.order) || body.order.some((id) => !ObjectId.isValid(id))) {
      return res.status(400).json({ error: 'A valid ordered list of item IDs is required.' });
    }
    await items.bulkWrite(body.order.map((id, order) => ({
      updateOne: { filter: { _id: new ObjectId(id) }, update: { $set: { order } } },
    })));
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
}
