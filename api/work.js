import { ObjectId } from 'mongodb';
import { collection, readBody, requireOwner, sendError, validExternalUrl, validImage } from './_lib.js';

const categories = new Set(['songs', 'covers', 'commercials', 'other']);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const items = await collection('work');
      const documents = await items.find({}).sort({ order: 1, _id: 1 }).toArray();
      return res.status(200).json(documents.map(({ _id, title, category, youtubeId, image, link }) => ({
        id: _id.toString(),
        title,
        category,
        youtubeId: youtubeId || null,
        image: image || null,
        link: link || null,
      })));
    }

    if (!['POST', 'DELETE', 'PUT'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, DELETE, PUT');
      return res.status(405).json({ error: 'Method not allowed.' });
    }
    if (!await requireOwner(req)) return res.status(403).json({ error: 'Owner access required.' });
    const items = await collection('work');

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (!body || typeof body.title !== 'string' || !body.title.trim() ||
          body.title.trim().length > 160 || !categories.has(body.category)) {
        return res.status(400).json({ error: 'Enter a title and select a valid category.' });
      }
      if (body.category === 'songs' &&
          (typeof body.youtubeId !== 'string' || !/^[\w-]{11}$/.test(body.youtubeId))) {
        return res.status(400).json({ error: 'Enter a valid YouTube video ID.' });
      }
      if (!validImage(body.image) || !validExternalUrl(body.link)) {
        return res.status(400).json({ error: 'The image or link is invalid or too large.' });
      }

      const document = {
        title: body.title.trim(),
        category: body.category,
        youtubeId: body.category === 'songs' ? body.youtubeId : null,
        image: body.image || null,
        link: body.link || null,
        order: -Date.now(),
      };
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
