export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  
  const response = await fetch(
    `https://api.notion.com/v1/databases/${process.env.NOTION_DB_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sorts: [{ property: 'Name', direction: 'ascending' }],
        page_size: 100,
      }),
    }
  );
  
  const data = await response.json();
  
  const recipes = (data.results || []).map(page => ({
    id: page.id,
    name: page.properties.Name?.title?.[0]?.plain_text || 'Unbekannt',
    calories: page.properties.Calories?.number || 0,
    protein: page.properties.Protein?.number || 0,
    carbs: page.properties.Carbs?.number || 0,
    fat: page.properties.Fats?.number || 0,
    fiber: page.properties.Fiber?.number || 0,
    sodium: page.properties.Sodium?.number || 0,
    cookingTime: page.properties['Cooking Time']?.number || 0,
    costPerServing: page.properties['Cost per serving']?.number || 0,
    tags: page.properties['Meal Prep']?.multi_select?.map(t => t.name) || [],
    rating: page.properties.Rating?.number || 0,
    url: page.properties.URL?.url || null,
  }));
  
  res.status(200).json(recipes);
}
