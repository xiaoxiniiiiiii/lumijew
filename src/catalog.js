const groups = [
  { id: 'earrings', name: 'Earrings', label: 'A little light, every day', names: ['Sculpted Golden Hoops','Pearl Drop Earrings','Arc Mini Hoops','Petal Enamel Drops','Organic Form Studs','Crystal Huggies','Lustre Pearl Hoops','Linework Bar Studs','Shell Trace Drops','Twist Rope Hoops','Color Glass Studs','Asymmetric Rhythm Drops'], prices: [18,22,16,24,14,29,26,12,21,23,19,28] },
  { id: 'necklaces', name: 'Necklaces', label: 'Layers that feel like you', names: ['Sol Pendant Chain','Freshwater Pearl Strand','Silver Layered Chain','Sea Glass Pendant','Sculptural Collar','Coin Charm Necklace','Tiny Stone Bezel','Mixed Metal Links','Shell Keepsake Pendant','Oval Heirloom Charm','Modern Bar Pendant','Pearl Y Necklace'], prices: [28,44,36,32,68,26,22,42,34,39,24,48] },
  { id: 'bracelets', name: 'Bracelets', label: 'The finishing touch', names: ['Classic Link Bracelet','Pearl Stretch Bracelet','Open Silver Cuff','Crystal Tennis Bracelet','Charm Cord Bracelet','Bold Chain Bracelet','Stone Bead Bracelet','Slim Everyday Bangle','Layered Chain Bracelet','Golden Anklet','Shell Anklet','Sculpted Open Cuff'], prices: [32,22,38,78,18,46,28,26,36,24,22,52] },
  { id: 'rings', name: 'Rings', label: 'Small pieces, strong presence', names: ['Dome Signet Ring','Silver Knot Ring','Pearl Open Ring','Color Enamel Band','Crystal Garden Ring','Stacking Band Set','Oval Glass Signet','Petal Gold Ring','Soft Wave Ring','Twist Silver Band','Stone Open Ring','Double Line Ring'], prices: [34,28,24,18,42,30,36,32,26,25,38,29] },
  { id: 'hair', name: 'Hair Accessories', label: 'A good hair day, on repeat', names: ['Tortoise Claw Clip','Pearl Barrette','Soft Satin Scrunchie','Sculpted Metal Headband','Crystal Hair Pin','Velvet Bow Clip','Shell Comb','Matte Claw Clip','Crystal Bobby Pins','Knot Fabric Headband','Gold Hair Cuff','Garden Flower Clip'], prices: [18,16,12,28,20,15,22,14,19,17,21,16] }
];

export const categories = groups;
export const products = groups.flatMap((group) => group.names.map((name, i) => ({
  id: `${group.id}-${String(i + 1).padStart(2, '0')}`,
  category: group.id,
  categoryName: group.name,
  name,
  price: group.prices[i],
  moq: 3,
  image: `/products/${group.id}-${String(i + 1).padStart(2, '0')}.webp`,
  sku: `RB-${group.id.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
  description: `A considered ${group.name.toLowerCase()} design for boutique assortments. Available in small wholesale quantities for easy testing and repeat orders.`
})));

export const company = {
  name: 'Rubaoge Porcelain Co., Ltd., Ruzhou City',
  email: 'Blithe6_uua@163.com',
  phone: '15037585529',
  address: 'No. 3, 200 meters south of Panzhuang Village Village Committee, Mimiao Town, Ruzhou City, Pingdingshan City, Henan Province'
};
