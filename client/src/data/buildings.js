// Buildings with units — units reference project IDs for linked deals

export function getInitialBuildings() {
  return [
    {
      _id: 'b1',
      name: 'Schrute Farms',
      address: '1725 Slough Ave',
      city: 'Scranton',
      state: 'PA',
      type: 'house',
      units: [
        {
          _id: 'u1',
          name: '1',
          bedrooms: '3br',
          monthlyCost: 4200,
          linkedProjectId: 'p1',
        },
        {
          _id: 'u2',
          name: '2',
          bedrooms: '2br',
          monthlyCost: 3100,
          linkedProjectId: null,
        },
      ],
    },
    {
      _id: 'b2',
      name: 'Lackawanna Lofts',
      address: '300 Spruce St',
      city: 'Scranton',
      state: 'PA',
      type: 'apartment',
      units: [
        {
          _id: 'u3',
          name: 'A',
          bedrooms: '3br',
          monthlyCost: 5800,
          linkedProjectId: 'p2',
        },
        {
          _id: 'u4',
          name: 'B',
          bedrooms: '2br',
          monthlyCost: 4200,
          linkedProjectId: null,
        },
        {
          _id: 'u5',
          name: 'C',
          bedrooms: '1br',
          monthlyCost: 2800,
          linkedProjectId: null,
        },
      ],
    },
    {
      _id: 'b3',
      name: 'Dunder Mifflin Commons',
      address: '1725 Industrial Park Rd',
      city: 'Scranton',
      state: 'PA',
      type: 'condo',
      units: [
        {
          _id: 'u6',
          name: '1',
          bedrooms: '2br',
          monthlyCost: 3600,
          linkedProjectId: 'p3',
        },
        {
          _id: 'u7',
          name: '2',
          bedrooms: '2br',
          monthlyCost: 3600,
          linkedProjectId: null,
        },
      ],
    },
  ];
}
