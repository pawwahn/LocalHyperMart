$ErrorActionPreference = 'Stop'
$out = 'D:\LocalHyperMart\LocalHyperMart\services\catalog-service\src\main\resources\db\migration\V13__seed_master_items_per_category.sql'

$kg = 'e1111111-1111-4111-8111-111111111111'
$pc = 'e2222222-2222-4222-8222-222222222222'
$lt = 'e3333333-3333-4333-8333-333333333333'
$pk = 'e4444444-4444-4444-8444-444444444444'

function CatUuid([int]$n) { 'c9a00000-{0:D4}-4000-8000-00000000{0:D4}' -f $n }
function Mid([int]$cat, [int]$item) {
  $c = '{0:x4}' -f $cat
  $i = '{0:x4}' -f $item
  $c3 = '{0:x3}' -f $cat
  $i3 = '{0:x3}' -f $item
  return "a13c$c-$i-4$c3-8$i3-$c${i}0000"
}

function Add-Cat($map, [int]$cat, $items) {
  if ($items.Count -ne 15) { throw "Category $cat has $($items.Count) items" }
  $map[$cat] = $items
}

$catalog = @{}

Add-Cat $catalog 1 @(
  @('Tomato 1kg','Local tomato',$kg,40),
  @('Onion 1kg','Red onion',$kg,35),
  @('Potato 1kg','Fresh potato',$kg,30),
  @('Green Chilli 250g','Hot green chilli',$pk,25),
  @('Coriander Bunch','Fresh coriander',$pc,15),
  @('Carrot 500g','Orange carrot',$pk,35),
  @('Cabbage 1pc','Fresh cabbage',$pc,40),
  @('Cauliflower 1pc','Fresh cauliflower',$pc,45),
  @('Brinjal 500g','Purple brinjal',$pk,30),
  @('Ladies Finger 500g','Okra',$pk,40),
  @('Capsicum 500g','Green capsicum',$pk,50),
  @('Cucumber 500g','Fresh cucumber',$pk,30),
  @('Ginger 250g','Fresh ginger',$pk,45),
  @('Garlic 250g','Fresh garlic',$pk,50),
  @('Lemon 4pc','Fresh lemon',$pk,20)
)

Add-Cat $catalog 2 @(
  @('Banana Robusta 1 dozen','Local banana',$pk,50),
  @('Apple Shimla 4pc','Shimla apple',$pk,120),
  @('Orange 1kg','Sweet orange',$kg,80),
  @('Papaya 1pc','Ripe papaya',$pc,60),
  @('Pomegranate 2pc','Fresh anar',$pk,90),
  @('Grapes 500g','Green grapes',$pk,70),
  @('Watermelon 1pc','Seasonal watermelon',$pc,80),
  @('Muskmelon 1pc','Sweet muskmelon',$pc,70),
  @('Guava 500g','Fresh guava',$pk,40),
  @('Mango Alphonso 1kg','Seasonal mango',$kg,250),
  @('Pineapple 1pc','Fresh pineapple',$pc,60),
  @('Mosambi 1kg','Sweet lime',$kg,70),
  @('Chikoo 500g','Sapota',$pk,45),
  @('Pear 4pc','Fresh pear',$pk,110),
  @('Kiwi 3pc','Imported kiwi',$pk,90)
)

Add-Cat $catalog 3 @(
  @('Toned Milk 500ml','Fresh toned milk',$pk,28),
  @('Full Cream Milk 1L','Full cream milk',$lt,60),
  @('Curd 400g','Fresh curd',$pk,35),
  @('Paneer 200g','Fresh paneer',$pk,90),
  @('Butter 100g','Salted butter',$pk,58),
  @('Ghee 200ml','Pure ghee',$pk,140),
  @('Cheese Slices 100g','Processed cheese',$pk,85),
  @('Bread White 400g','Sandwich bread',$pk,40),
  @('Brown Bread 400g','Whole wheat bread',$pk,45),
  @('Eggs Farm Fresh 6pc','Farm eggs',$pk,48),
  @('Eggs 12pc','Tray eggs',$pk,90),
  @('Buttermilk 200ml','Spiced buttermilk',$pk,20),
  @('Flavoured Milk 200ml','Chocolate milk',$pk,30),
  @('Fresh Cream 200ml','Dairy cream',$pk,70),
  @('Lassi Sweet 200ml','Sweet lassi',$pk,25)
)

Add-Cat $catalog 4 @(
  @('Sona Masoori Rice 1kg','Daily rice',$kg,65),
  @('Basmati Rice 1kg','Premium basmati',$kg,140),
  @('Wheat Atta 1kg','Chakki atta',$kg,55),
  @('Toor Dal 1kg','Arhar dal',$kg,160),
  @('Moong Dal 1kg','Yellow moong',$kg,140),
  @('Urad Dal 1kg','Black gram',$kg,150),
  @('Chana Dal 1kg','Bengal gram',$kg,110),
  @('Masoor Dal 1kg','Red lentils',$kg,120),
  @('Idli Rice 1kg','Idli rice',$kg,70),
  @('Poha 500g','Flattened rice',$pk,45),
  @('Rava Sooji 500g','Semolina',$pk,40),
  @('Maida 1kg','Refined flour',$kg,50),
  @('Besan 500g','Gram flour',$pk,55),
  @('Rajma 500g','Kidney beans',$pk,90),
  @('Kabuli Chana 500g','Chickpeas',$pk,80)
)

Add-Cat $catalog 5 @(
  @('Sunflower Oil 1L','Refined sunflower',$lt,150),
  @('Groundnut Oil 1L','Peanut oil',$lt,180),
  @('Mustard Oil 1L','Kachi ghani',$lt,170),
  @('Coconut Oil 500ml','Virgin coconut',$pk,160),
  @('Rice Bran Oil 1L','Light cooking oil',$lt,155),
  @('Olive Oil 250ml','Extra virgin',$pk,320),
  @('Ghee Cow 500ml','Cow ghee',$pk,340),
  @('Ghee Buffalo 500ml','Buffalo ghee',$pk,300),
  @('Vanaspati 500g','Cooking fat',$pk,90),
  @('Sesame Oil 200ml','Gingelly oil',$pk,120),
  @('Palm Oil 1L','Palm cooking oil',$lt,120),
  @('Blended Oil 1L','Multi seed oil',$lt,145),
  @('Castor Oil 100ml','Hair skin oil',$pk,60),
  @('Ghee Sachet 10ml','Single serve ghee',$pk,10),
  @('Oil Spray 200ml','Cooking spray',$pk,180)
)

Add-Cat $catalog 6 @(
  @('Turmeric Powder 100g','Haldi',$pk,35),
  @('Chilli Powder 100g','Red chilli',$pk,40),
  @('Coriander Powder 100g','Dhania powder',$pk,35),
  @('Garam Masala 50g','Garam masala',$pk,45),
  @('Cumin Seeds 100g','Jeera',$pk,50),
  @('Mustard Seeds 100g','Rai',$pk,30),
  @('Black Pepper 50g','Kali mirch',$pk,55),
  @('Sambar Powder 100g','Sambar mix',$pk,45),
  @('Rasam Powder 100g','Rasam mix',$pk,45),
  @('Chicken Masala 50g','Chicken spice',$pk,40),
  @('Biryani Masala 50g','Biryani spice',$pk,50),
  @('Chat Masala 50g','Chat spice',$pk,35),
  @('Kitchen King 50g','Kitchen king',$pk,40),
  @('Hing 25g','Asafoetida',$pk,60),
  @('Salt Iodised 1kg','Table salt',$kg,25)
)

Add-Cat $catalog 7 @(
  @('Potato Chips Classic 50g','Salted chips',$pk,20),
  @('Potato Chips Masala 50g','Masala chips',$pk,20),
  @('Corn Puffs 40g','Cheese puffs',$pk,15),
  @('Mixture South 200g','South Indian mix',$pk,55),
  @('Bhujia 200g','Sev bhujia',$pk,50),
  @('Murukku 200g','Crispy murukku',$pk,55),
  @('Banana Chips 150g','Kerala chips',$pk,60),
  @('Khakhra 200g','Gujarati khakhra',$pk,70),
  @('Popcorn Butter 50g','Butter popcorn',$pk,25),
  @('Nachos Cheese 70g','Cheese nachos',$pk,40),
  @('Roasted Peanuts 200g','Salted peanuts',$pk,55),
  @('Chana Jor Garam 150g','Spicy chana',$pk,45),
  @('Mathri 200g','Salty mathri',$pk,60),
  @('Fryums 100g','Fryums pack',$pk,30),
  @('Energy Bar Nut 40g','Nut snack bar',$pk,35)
)

Add-Cat $catalog 8 @(
  @('Milk Chocolate Bar 40g','Milk chocolate',$pk,40),
  @('Dark Chocolate 40g','Dark chocolate',$pk,50),
  @('Candy Assorted 100g','Mixed candy',$pk,35),
  @('Lollipop Pack 10pc','Fruit lollipops',$pk,30),
  @('Gulab Jamun Tin 500g','Ready gulab jamun',$pk,120),
  @('Rasgulla Tin 500g','Sponge rasgulla',$pk,110),
  @('Soan Papdi 250g','Soan papdi',$pk,80),
  @('Mysore Pak 250g','Mysore pak',$pk,120),
  @('Halwa Mix 200g','Instant halwa',$pk,70),
  @('Jelly Cups 6pc','Fruit jelly',$pk,40),
  @('Marshmallow 100g','Soft marshmallow',$pk,55),
  @('Toffee Eclair 100g','Milk toffee',$pk,30),
  @('Wafer Chocolate 50g','Choco wafer',$pk,25),
  @('Ice Cream Cone Pack','Empty cones',$pk,40),
  @('Dessert Mix Brownie','Brownie mix',$pk,90)
)

Add-Cat $catalog 9 @(
  @('Cola Soft Drink 750ml','Classic cola',$pk,40),
  @('Lemon Soda 600ml','Sparkling lemon',$pk,30),
  @('Orange Soft Drink 750ml','Orange soda',$pk,40),
  @('Packaged Water 1L','Drinking water',$lt,20),
  @('Orange Juice 1L','Pure orange juice',$lt,110),
  @('Apple Juice 1L','Apple juice',$lt,120),
  @('Mango Drink 1L','Mango beverage',$lt,90),
  @('Energy Drink 250ml','Caffeinated drink',$pk,110),
  @('Coconut Water 200ml','Tender coconut',$pk,40),
  @('Soda Water 750ml','Club soda',$pk,25),
  @('Lime Juice Cordial 750ml','Lime cordial',$pk,95),
  @('Iced Tea 500ml','Lemon iced tea',$pk,50),
  @('Buttermilk Drink 200ml','Spiced chaas',$pk,20),
  @('Fruit Punch 1L','Mixed fruit',$lt,85),
  @('Sparkling Water 500ml','Plain sparkling',$pk,45)
)

Add-Cat $catalog 10 @(
  @('Glucose Biscuit 100g','Glucose biscuits',$pk,20),
  @('Marie Biscuit 200g','Marie light',$pk,30),
  @('Cream Biscuit 100g','Vanilla cream',$pk,25),
  @('Chocolate Cookie 100g','Choco cookies',$pk,40),
  @('Salted Cracker 100g','Salt crackers',$pk,25),
  @('Rusk Toast 200g','Milk rusk',$pk,45),
  @('Digestive Biscuit 200g','Wheat digestive',$pk,50),
  @('Butter Cookie 150g','Butter cookies',$pk,55),
  @('Cake Slice Vanilla','Vanilla cake',$pc,40),
  @('Cup Cake Chocolate 2pc','Choco cupcakes',$pk,50),
  @('Fruit Cake 250g','Plum cake',$pk,120),
  @('Khari Puff 200g','Khari biscuits',$pk,45),
  @('Jeera Biscuit 150g','Cumin biscuits',$pk,35),
  @('Oats Cookie 150g','Healthy oats cookie',$pk,60),
  @('Bakery Bun 4pc','Sweet buns',$pk,40)
)

Add-Cat $catalog 11 @(
  @('Instant Noodles Masala 70g','Masala noodles',$pk,16),
  @('Instant Noodles Cup','Cup noodles',$pk,40),
  @('Ready Soup Tomato','Tomato soup',$pk,25),
  @('Ready Meal Veg Pulao','Instant pulao',$pk,80),
  @('Frozen Paratha 400g','Plain paratha',$pk,90),
  @('Frozen Peas 500g','Green peas',$pk,70),
  @('Frozen Sweet Corn 500g','Sweet corn',$pk,75),
  @('Instant Upma Mix 200g','Upma mix',$pk,55),
  @('Instant Poha Mix 200g','Poha mix',$pk,50),
  @('Ready Dal Tadka Pack','Instant dal',$pk,70),
  @('Frozen Samosa 10pc','Veg samosa',$pk,120),
  @('Frozen French Fries 400g','Potato fries',$pk,110),
  @('Instant Idli Mix 500g','Idli mix',$pk,80),
  @('Ready Biryani Pack','Veg biryani',$pk,150),
  @('Frozen Pizza Base 2pc','Pizza base',$pk,90)
)

Add-Cat $catalog 12 @(
  @('Chicken Curry Cut 500g','Fresh chicken',$pk,160),
  @('Chicken Breast 500g','Boneless breast',$pk,220),
  @('Mutton Curry Cut 500g','Goat meat',$pk,450),
  @('Fish Rohu Steaks 500g','Fresh rohu',$pk,250),
  @('Prawns Medium 250g','Cleaned prawns',$pk,320),
  @('Eggs Brown 6pc','Brown eggs',$pk,60),
  @('Chicken Keema 500g','Minced chicken',$pk,200),
  @('Fish Pomfret 500g','White pomfret',$pk,400),
  @('Crab Fresh 500g','Fresh crab',$pk,350),
  @('Chicken Leg Quarters 500g','Leg pieces',$pk,180),
  @('Mutton Keema 500g','Minced mutton',$pk,480),
  @('Fish Fillet 300g','Boneless fillet',$pk,280),
  @('Chicken Wings 500g','Spicy wings cut',$pk,190),
  @('Dried Fish 100g','Bombay duck dry',$pk,120),
  @('Country Chicken 500g','Nati chicken',$pk,280)
)

Add-Cat $catalog 13 @(
  @('Corn Flakes 500g','Corn flakes',$pk,180),
  @('Oats Rolled 500g','Rolled oats',$pk,120),
  @('Muesli Fruit 400g','Fruit muesli',$pk,220),
  @('Choco Cereal 500g','Chocolate cereal',$pk,200),
  @('Wheat Flakes 500g','Wheat flakes',$pk,160),
  @('Ragi Flakes 300g','Ragi breakfast',$pk,140),
  @('Instant Oats 400g','Quick oats',$pk,110),
  @('Granola Honey 300g','Honey granola',$pk,250),
  @('Breakfast Mix Millet','Millet mix',$pk,150),
  @('Poha Thick 500g','Thick poha',$pk,50),
  @('Dalia Broken Wheat 500g','Dalia',$pk,55),
  @('Vermicelli Breakfast 400g','Semiya',$pk,45),
  @('Chia Seeds 100g','Chia seeds',$pk,120),
  @('Peanut Butter 350g','Creamy peanut',$pk,180),
  @('Honey 250g','Pure honey',$pk,160)
)

Add-Cat $catalog 14 @(
  @('Tomato Ketchup 500g','Tomato ketchup',$pk,95),
  @('Green Chilli Sauce 200g','Chilli sauce',$pk,55),
  @('Soy Sauce 200ml','Dark soy',$pk,60),
  @('Mayonnaise 250g','Egg mayo',$pk,110),
  @('Jam Mixed Fruit 500g','Fruit jam',$pk,120),
  @('Peanut Butter Crunchy 350g','Crunchy peanut',$pk,190),
  @('Chocolate Spread 350g','Choco hazelnut',$pk,220),
  @('Mustard Sauce 200g','Yellow mustard',$pk,70),
  @('Pizza Pasta Sauce 200g','Pasta sauce',$pk,85),
  @('Schezwan Sauce 250g','Schezwan dip',$pk,90),
  @('Vinegar White 500ml','White vinegar',$pk,40),
  @('Pickle Mango 400g','Mango pickle',$pk,110),
  @('Pickle Mixed 400g','Mixed pickle',$pk,100),
  @('Honey Mustard 200g','Honey mustard',$pk,95),
  @('Butter Spread 200g','Table spread',$pk,75)
)

Add-Cat $catalog 15 @(
  @('Tea Dust 250g','Assam tea dust',$pk,90),
  @('Tea Bags 100pc','Regular tea bags',$pk,140),
  @('Green Tea 25 Bags','Green tea',$pk,120),
  @('Filter Coffee Powder 200g','South filter coffee',$pk,160),
  @('Instant Coffee 50g','Instant coffee',$pk,180),
  @('Coffee Premix 10 Sachets','3-in-1 coffee',$pk,90),
  @('Boost Malt 500g','Chocolate malt',$pk,240),
  @('Horlicks 500g','Malted drink',$pk,260),
  @('Bournvita 500g','Malt drink',$pk,250),
  @('Badam Milk Mix 200g','Badam mix',$pk,150),
  @('Hot Chocolate 200g','Cocoa mix',$pk,140),
  @('Herbal Tea Tulsi','Tulsi tea',$pk,110),
  @('Elaichi Tea 250g','Cardamom tea',$pk,100),
  @('Cold Coffee Concentrate','Coffee concentrate',$pk,130),
  @('Milk Masala Mix 100g','Masala milk',$pk,70)
)

Add-Cat $catalog 16 @(
  @('Detergent Powder 1kg','Washing powder',$kg,120),
  @('Detergent Bar 4pc','Wash bars',$pk,40),
  @('Dishwash Liquid 500ml','Dish liquid',$pk,90),
  @('Dishwash Bar 3pc','Dish bars',$pk,30),
  @('Floor Cleaner 1L','Phenyl floor',$lt,110),
  @('Toilet Cleaner 500ml','Toilet liquid',$pk,85),
  @('Glass Cleaner 500ml','Glass spray',$pk,95),
  @('Hand Wash Liquid 250ml','Handwash',$pk,70),
  @('Mosquito Coil 10pc','Mosquito coils',$pk,40),
  @('Mosquito Liquid Refill','Vaporiser refill',$pk,80),
  @('Insect Spray 200ml','Crawling insect',$pk,120),
  @('Fabric Softener 500ml','Softener',$pk,130),
  @('Bleach Liquid 500ml','Bleach',$pk,60),
  @('Scrub Pad 3pc','Kitchen scrub',$pk,25),
  @('Garbage Bags Medium 30pc','Trash bags',$pk,50)
)

Add-Cat $catalog 17 @(
  @('Antiseptic Liquid 100ml','Antiseptic',$pk,50),
  @('Bandage Strip 10pc','Adhesive bandage',$pk,30),
  @('Cotton Roll 100g','Absorbent cotton',$pk,45),
  @('ORS Sachets 10pc','ORS powder',$pk,40),
  @('Paracetamol 500mg 10pc','Pain relief',$pk,20),
  @('Antacid Tablets 10pc','Acidity relief',$pk,25),
  @('Cough Syrup 100ml','Cough syrup',$pk,90),
  @('Hand Sanitizer 100ml','Sanitizer gel',$pk,50),
  @('Thermometer Digital','Digital thermometer',$pc,180),
  @('Face Mask 5pc','Surgical mask',$pk,40),
  @('Vicks Balm 25g','Menthol balm',$pk,55),
  @('Eye Drops 10ml','Lubricant drops',$pk,70),
  @('Glucose Powder 100g','Energy glucose',$pk,35),
  @('Electrolyte Drink Mix','ORS drink',$pk,30),
  @('First Aid Kit Mini','Travel first aid',$pk,250)
)

Add-Cat $catalog 18 @(
  @('Bath Soap 100g','Bathing soap',$pk,35),
  @('Body Wash 200ml','Body wash',$pk,120),
  @('Shampoo Soft 180ml','Mild shampoo',$pk,110),
  @('Conditioner 180ml','Hair conditioner',$pk,130),
  @('Talcum Powder 100g','Body powder',$pk,70),
  @('Deodorant Spray 150ml','Body deodorant',$pk,160),
  @('Face Wash 100ml','Daily face wash',$pk,90),
  @('Toothpaste 150g','Fluoride paste',$pk,85),
  @('Toothbrush Soft 2pc','Soft brush',$pk,50),
  @('Mouthwash 250ml','Oral rinse',$pk,110),
  @('Hand Cream 50ml','Moisturiser',$pk,80),
  @('Body Lotion 200ml','Body lotion',$pk,140),
  @('Shaving Foam 200ml','Shave foam',$pk,150),
  @('Razor Disposable 5pc','Disposable razor',$pk,70),
  @('Bath Loofah 1pc','Bath scrub',$pc,40)
)

Add-Cat $catalog 19 @(
  @('Face Cream Fairness 50g','Day cream',$pk,120),
  @('Kajal Pencil','Kajal',$pc,60),
  @('Lip Balm SPF','Lip balm',$pc,50),
  @('Compact Powder','Face compact',$pc,140),
  @('Nail Polish Nude','Nail colour',$pc,80),
  @('Hair Oil Amla 100ml','Amla oil',$pk,70),
  @('Hair Gel 100ml','Styling gel',$pk,90),
  @('Beard Oil 30ml','Beard oil',$pk,150),
  @('Perfume Body Mist 120ml','Body mist',$pk,180),
  @('Makeup Remover 100ml','Makeup wipe liquid',$pk,110),
  @('Eyebrow Pencil','Brow pencil',$pc,70),
  @('Blush Compact','Cheek blush',$pc,160),
  @('BB Cream 30g','BB cream',$pk,190),
  @('Hair Colour Natural Black','Hair colour',$pk,120),
  @('Manicure Kit Mini','Nail kit',$pk,200)
)

Add-Cat $catalog 20 @(
  @('Baby Diaper M 10pc','Medium diapers',$pk,180),
  @('Baby Wipes 80pc','Gentle wipes',$pk,120),
  @('Baby Soap 75g','Mild baby soap',$pk,45),
  @('Baby Shampoo 100ml','Tear-free shampoo',$pk,110),
  @('Baby Oil 100ml','Massage oil',$pk,90),
  @('Baby Powder 100g','Baby powder',$pk,80),
  @('Baby Lotion 100ml','Moisturising lotion',$pk,100),
  @('Baby Cereal Rice 300g','Rice cereal',$pk,160),
  @('Baby Formula Stage 1 400g','Infant formula',$pk,450),
  @('Feeding Bottle 250ml','BPA free bottle',$pc,180),
  @('Pacifier Soft','Baby pacifier',$pc,90),
  @('Diaper Rash Cream 50g','Rash cream',$pk,120),
  @('Baby Toothbrush','Finger brush',$pc,60),
  @('Baby Laundry Detergent 500g','Gentle wash',$pk,140),
  @('Cotton Buds Baby 50pc','Soft buds',$pk,40)
)

Add-Cat $catalog 21 @(
  @('Dog Food Adult 1kg','Dry dog food',$kg,280),
  @('Cat Food Adult 1kg','Dry cat food',$kg,320),
  @('Pet Treat Biscuits 200g','Pet biscuits',$pk,90),
  @('Cat Litter 5kg','Clay litter',$kg,250),
  @('Pet Shampoo 200ml','Pet shampoo',$pk,150),
  @('Dog Collar Medium','Adjustable collar',$pc,120),
  @('Pet Leash Nylon','Walking leash',$pc,140),
  @('Pet Bowl Steel','Food bowl',$pc,80),
  @('Cat Wet Food 85g','Tuna wet food',$pk,60),
  @('Dog Chew Stick 4pc','Chew sticks',$pk,100),
  @('Pet Toy Ball','Rubber ball',$pc,70),
  @('Flea Powder 100g','Flea control',$pk,110),
  @('Bird Seed Mix 500g','Bird feed',$pk,90),
  @('Aquarium Fish Food 100g','Fish flakes',$pk,80),
  @('Pet Grooming Brush','Fur brush',$pc,130)
)

Add-Cat $catalog 22 @(
  @('Steel Glass Set 6pc','Drinking glasses',$pk,180),
  @('Dinner Plate Set 6pc','Melamine plates',$pk,250),
  @('Nonstick Frying Pan 24cm','Fry pan',$pc,450),
  @('Pressure Cooker 3L','Aluminium cooker',$pc,1200),
  @('Kitchen Knife Set','3 knife set',$pk,350),
  @('Chopping Board Plastic','Cutting board',$pc,120),
  @('Storage Container 3pc','Airtight boxes',$pk,200),
  @('Water Bottle 1L','Steel bottle',$pc,250),
  @('Lunch Box 3 Tier','Tiffin box',$pc,320),
  @('Tea Strainer Steel','Tea filter',$pc,40),
  @('Gas Lighter','Kitchen lighter',$pc,50),
  @('Kitchen Towel 2pc','Cotton towel',$pk,90),
  @('Spatula Silicone Set','Cooking spatulas',$pk,150),
  @('Mixer Jar Spare','Spare jar',$pc,400),
  @('LED Bulb 9W','Energy bulb',$pc,80)
)

Add-Cat $catalog 23 @(
  @('USB Charging Cable','Type-C cable',$pc,150),
  @('Power Bank 10000mAh','Portable charger',$pc,1200),
  @('Earphones Wired','In-ear phones',$pc,250),
  @('Bluetooth Earphones','Wireless buds',$pc,999),
  @('Extension Board 4 Socket','Power strip',$pc,350),
  @('LED Night Lamp','Night light',$pc,180),
  @('Electric Kettle 1.5L','Water kettle',$pc,799),
  @('Iron Dry Press','Dry iron',$pc,699),
  @('Mixer Grinder Basic','3 jar mixer',$pc,2499),
  @('Torch Rechargeable','LED torch',$pc,300),
  @('Wall Clock Analog','Home clock',$pc,350),
  @('Table Fan Portable','Desk fan',$pc,899),
  @('Phone Holder Car','Car mount',$pc,200),
  @('Memory Card 32GB','MicroSD',$pc,400),
  @('Remote AAA Battery 4pc','Alkaline cells',$pk,80)
)

Add-Cat $catalog 24 @(
  @('Betel Leaves Fresh 10pc','Paan leaves',$pk,40),
  @('Supari Pack 50g','Areca nut',$pk,35),
  @('Meetha Paan Ready 2pc','Sweet paan',$pk,50),
  @('Saada Paan Ready 2pc','Plain paan',$pk,40),
  @('Mouth Freshener 50g','Mukwas',$pk,45),
  @('Fennel Candy 100g','Saunf candy',$pk,40),
  @('Clove Pack 25g','Laung',$pk,50),
  @('Cardamom Green 25g','Elaichi',$pk,120),
  @('Tobacco Free Paan Masala','Herbal masala',$pk,30),
  @('Coconut Pieces Sweet 100g','Copra sweet',$pk,55),
  @('Chutney Mint Paan','Paan chutney',$pk,35),
  @('Rose Petal Jam 100g','Gulkand',$pk,80),
  @('Chuna Pack','Slaked lime',$pk,20),
  @('Paan Tray Disposable 10pc','Serving tray',$pk,40),
  @('Digestive After Meal Mix','Mukhwass mix',$pk,60)
)

Add-Cat $catalog 25 @(
  @('Vanilla Cup Ice Cream','Vanilla cup',$pc,40),
  @('Chocolate Cone','Choco cone',$pc,50),
  @('Butterscotch Tub 500ml','Butterscotch',$pk,180),
  @('Mango Kulfi 2pc','Mango kulfi',$pk,60),
  @('Cassata Slice','Cassata',$pc,70),
  @('Ice Cream Sandwich','Cookie sandwich',$pc,45),
  @('Fruit Bar Popsicle','Fruit ice bar',$pc,30),
  @('Chocolate Brownie Ice Cream','Brownie scoop',$pc,80),
  @('Strawberry Tub 500ml','Strawberry',$pk,180),
  @('Kulfi Malai 2pc','Malai kulfi',$pk,70),
  @('Frozen Yogurt Cup','Frozen yogurt',$pc,90),
  @('Ice Cream Cake Mini','Mini cake',$pc,250),
  @('Sorbet Lemon Cup','Lemon sorbet',$pc,60),
  @('Choco Chip Cookie Dough','Cookie dough',$pc,85),
  @('Family Pack Assorted 1L','Assorted tub',$lt,320)
)

Add-Cat $catalog 26 @(
  @('Dairy Milk 12g','Mini chocolate',$pc,10),
  @('Dairy Milk Silk 60g','Silk bar',$pc,80),
  @('KitKat 2 Finger','Wafer chocolate',$pc,20),
  @('5 Star 22g','Choco caramel',$pc,20),
  @('Perk 18g','Wafer perk',$pc,10),
  @('Munch 20g','Crispy munch',$pc,10),
  @('Snickers 50g','Peanut bar',$pc,50),
  @('Bournville 40g','Dark chocolate',$pc,50),
  @('Celebrations Mini Pack','Assorted mini',$pk,150),
  @('Gems Chocolate 17g','Candy coated',$pc,10),
  @('Fuse 25g','Choco fuse',$pc,20),
  @('Milky Bar 20g','White chocolate',$pc,20),
  @('Dark Fantasy Cookie','Choco cookie',$pk,30),
  @('Chocolate Gift Box 200g','Gift chocolates',$pk,280),
  @('Hot Chocolate Sachet 5pc','Cocoa sachets',$pk,90)
)

Add-Cat $catalog 27 @(
  @('Gulab Jamun Fresh 250g','Fresh jamun',$pk,90),
  @('Rasgulla Fresh 250g','Fresh rasgulla',$pk,85),
  @('Laddu Besan 250g','Besan laddu',$pk,100),
  @('Laddu Motichoor 250g','Motichoor',$pk,110),
  @('Barfi Kaju 250g','Kaju barfi',$pk,280),
  @('Jalebi Fresh 200g','Hot jalebi',$pk,70),
  @('Halwa Carrot 250g','Gajar halwa',$pk,120),
  @('Mysore Pak Soft 250g','Soft mysore pak',$pk,130),
  @('Peda Milk 250g','Milk peda',$pk,140),
  @('Imarti 200g','Imarti sweet',$pk,80),
  @('Cham Cham 250g','Cham cham',$pk,100),
  @('Kalakand 250g','Kalakand',$pk,150),
  @('Soan Papdi Premium 250g','Flaky soan',$pk,90),
  @('Milk Cake 250g','Milk cake',$pk,160),
  @('Dry Fruit Sweet Mix 200g','Assorted sweets',$pk,220)
)

Add-Cat $catalog 28 @(
  @('Egg Noodles 200g','Hakka noodles',$pk,45),
  @('Rice Noodles 200g','Rice stick',$pk,55),
  @('Pasta Penne 500g','Penne pasta',$pk,120),
  @('Pasta Spaghetti 500g','Spaghetti',$pk,120),
  @('Pasta Macaroni 500g','Elbow macaroni',$pk,110),
  @('Vermicelli Roasted 400g','Roasted semiya',$pk,50),
  @('Instant Pasta Cheese','Cheese pasta',$pk,40),
  @('Schezwan Noodles Kit','Noodle kit',$pk,70),
  @('Whole Wheat Pasta 500g','Atta pasta',$pk,140),
  @('Glass Noodles 100g','Transparent noodles',$pk,60),
  @('Udon Noodles 200g','Thick udon',$pk,90),
  @('Pasta Sauce Ready 200g','Ready sauce',$pk,85),
  @('Lasagna Sheets 250g','Lasagna',$pk,160),
  @('Cup Pasta Masala','Instant pasta cup',$pk,45),
  @('Millet Noodles 200g','Healthy noodles',$pk,80)
)

Add-Cat $catalog 29 @(
  @('Frozen Aloo Tikki 10pc','Aloo tikki',$pk,110),
  @('Frozen Veg Burger Patty 4pc','Burger patty',$pk,120),
  @('Frozen Spring Roll 10pc','Veg spring roll',$pk,130),
  @('Frozen Nuggets 400g','Veg nuggets',$pk,150),
  @('Frozen Chicken Nuggets 400g','Chicken nuggets',$pk,220),
  @('Frozen Fish Fingers 300g','Fish fingers',$pk,200),
  @('Frozen Momos Veg 10pc','Veg momos',$pk,140),
  @('Frozen Momos Chicken 10pc','Chicken momos',$pk,180),
  @('Frozen Malabar Paratha 5pc','Kerala paratha',$pk,100),
  @('Frozen Garlic Bread 200g','Garlic bread',$pk,120),
  @('Frozen Corn Dog 4pc','Corn dogs',$pk,160),
  @('Frozen Pizza Veg 1pc','Ready pizza',$pc,199),
  @('Frozen Cutlet Mix 400g','Veg cutlet',$pk,130),
  @('Frozen Idli 12pc','Ready idli',$pk,90),
  @('Frozen Dosa Batter 1kg','Dosa batter',$kg,80)
)

Add-Cat $catalog 30 @(
  @('Almonds 200g','California almonds',$pk,280),
  @('Cashews 200g','W320 cashews',$pk,300),
  @('Raisins 200g','Kishmish',$pk,90),
  @('Walnuts 200g','Walnut kernels',$pk,320),
  @('Pistachio 100g','Roasted pista',$pk,220),
  @('Dates 250g','Seeded dates',$pk,120),
  @('Figs Dried 200g','Anjeer',$pk,180),
  @('Apricot Dried 200g','Khubani',$pk,160),
  @('Pumpkin Seeds 100g','Pepitas',$pk,110),
  @('Sunflower Seeds 100g','Sunflower seeds',$pk,70),
  @('Flax Seeds 100g','Alsi',$pk,60),
  @('Mixed Dry Fruits 250g','Trail mix',$pk,250),
  @('Fox Nuts Makhana 100g','Roasted makhana',$pk,140),
  @('Coconut Dry Chips 100g','Copra chips',$pk,80),
  @('Chia Flax Mix 150g','Seed mix',$pk,130)
)

Add-Cat $catalog 31 @(
  @('Shampoo Anti Dandruff 180ml','Anti-dandruff',$pk,140),
  @('Shampoo Soft Care 180ml','Daily shampoo',$pk,120),
  @('Hair Conditioner 180ml','Conditioner',$pk,130),
  @('Hair Oil Coconut 200ml','Coconut hair oil',$pk,90),
  @('Hair Oil Almond 100ml','Almond oil',$pk,110),
  @('Hair Serum 50ml','Shine serum',$pk,220),
  @('Hair Colour Natural Black','Permanent colour',$pk,130),
  @('Hair Colour Brown','Brown colour',$pk,130),
  @('Hair Gel Strong Hold','Styling gel',$pk,100),
  @('Hair Spray 200ml','Hold spray',$pk,180),
  @('Hair Mask 100ml','Repair mask',$pk,200),
  @('Scalp Tonic 50ml','Hair tonic',$pk,160),
  @('Baby Soft Shampoo 100ml','Kids shampoo',$pk,110),
  @('Dry Shampoo 100ml','Dry shampoo',$pk,250),
  @('Hair Comb Wide Tooth','Detangle comb',$pc,60)
)

Add-Cat $catalog 32 @(
  @('Face Wash Neem 100ml','Neem face wash',$pk,90),
  @('Moisturiser Day 50g','Day cream',$pk,120),
  @('Night Cream 50g','Night cream',$pk,150),
  @('Sunscreen SPF50 50g','Sunscreen',$pk,220),
  @('Face Scrub 50g','Exfoliating scrub',$pk,100),
  @('Toner Rose 100ml','Rose toner',$pk,110),
  @('Aloe Vera Gel 100g','Aloe gel',$pk,80),
  @('Vitamin C Serum 30ml','Brightening serum',$pk,350),
  @('Under Eye Cream 15g','Eye cream',$pk,180),
  @('Lip Scrub','Lip scrub',$pc,90),
  @('Body Scrub 200g','Body polish',$pk,160),
  @('Sheet Mask 1pc','Hydrating mask',$pc,70),
  @('Face Pack Multani 100g','Clay pack',$pk,60),
  @('Cold Cream 50g','Cold cream',$pk,70),
  @('Hand and Nail Cream 50ml','Hand cream',$pk,90)
)

Add-Cat $catalog 33 @(
  @('Foundation Liquid 30ml','Liquid foundation',$pk,350),
  @('Compact Powder Beige','Compact',$pc,180),
  @('Kajal Waterproof','Kajal',$pc,90),
  @('Eyeliner Liquid','Liquid liner',$pc,120),
  @('Mascara Volume','Volume mascara',$pc,220),
  @('Lipstick Matte Red','Matte lipstick',$pc,199),
  @('Lip Gloss Clear','Lip gloss',$pc,150),
  @('Blush Peach','Powder blush',$pc,180),
  @('Highlighter Stick','Glow stick',$pc,250),
  @('Eyeshadow Palette 6','Mini palette',$pk,399),
  @('Makeup Brush Set 5pc','Brush set',$pk,299),
  @('Primer Face 30ml','Face primer',$pk,280),
  @('Setting Spray 50ml','Makeup setter',$pk,260),
  @('Nail Polish Red','Nail colour',$pc,80),
  @('Makeup Sponge 2pc','Beauty blender',$pk,120)
)

Add-Cat $catalog 34 @(
  @('Sanitary Pads Regular 10pc','Day pads',$pk,80),
  @('Sanitary Pads Night 7pc','Night pads',$pk,90),
  @('Panty Liners 20pc','Liners',$pk,70),
  @('Intimate Wash 100ml','Intimate wash',$pk,150),
  @('Tampons Regular 8pc','Tampons',$pk,120),
  @('Menstrual Cup Soft','Menstrual cup',$pc,350),
  @('Tissue Box 100 Pulls','Facial tissue',$pk,80),
  @('Wet Wipes Adult 40pc','Adult wipes',$pk,90),
  @('Cotton Pads 50pc','Makeup pads',$pk,60),
  @('Ear Buds 100pc','Cotton buds',$pk,40),
  @('Toilet Paper 4 Rolls','Tissue rolls',$pk,110),
  @('Handkerchief Pack 3pc','Cotton hanky',$pk,80),
  @('Deodorant Roll-On 50ml','Roll-on',$pk,120),
  @('Foot Care Cream 50g','Foot cream',$pk,90),
  @('Antifungal Dusting Powder','Foot powder',$pk,70)
)

Add-Cat $catalog 35 @(
  @('Condoms Regular 3pc','Latex condoms',$pk,60),
  @('Condoms Dotted 3pc','Dotted condoms',$pk,70),
  @('Condoms Extra Time 3pc','Delay condoms',$pk,80),
  @('Lubricant Water Based 50ml','Personal lube',$pk,180),
  @('Condoms Pack 10pc','Value pack',$pk,180),
  @('Intimate Wipe 10pc','Intimate wipes',$pk,90),
  @('Pregnancy Test Kit','Test kit',$pc,80),
  @('Ovulation Test Kit','LH test',$pc,150),
  @('Massage Oil Neutral 50ml','Massage oil',$pk,160),
  @('Condoms Flavoured 3pc','Flavoured',$pk,75),
  @('Feminine Hygiene Wash 100ml','pH wash',$pk,160),
  @('Wellness Multivitamin 30pc','Daily multi',$pk,220),
  @('Energy Supplement 10pc','Energy tabs',$pk,180),
  @('Personal Care Kit Travel','Travel kit',$pk,250),
  @('Disposable Sheets 2pc','Hygiene sheets',$pk,120)
)

Add-Cat $catalog 36 @(
  @('Protein Powder 500g','Whey protein',$pk,1200),
  @('Multivitamin Tablets 30pc','Daily vitamins',$pk,250),
  @('Vitamin C 60pc','Immunity C',$pk,180),
  @('Calcium Tablets 30pc','Bone health',$pk,160),
  @('Omega 3 Capsules 30pc','Fish oil',$pk,280),
  @('Iron Syrup 200ml','Iron tonic',$pk,140),
  @('Probiotic Capsules 10pc','Gut health',$pk,200),
  @('Green Tea Detox 25 Bags','Detox tea',$pk,150),
  @('Protein Bar 40g','Energy bar',$pc,80),
  @('Electral Powder 21g','ORS',$pk,20),
  @('Diabetes Care Cookies','Sugar free cookie',$pk,90),
  @('Meal Replacement Shake','Diet shake',$pk,350),
  @('Collagen Powder 100g','Collagen',$pk,600),
  @('Ashwagandha Capsules 60pc','Herbal',$pk,280),
  @('Zinc Tablets 30pc','Immunity zinc',$pk,120)
)

Add-Cat $catalog 37 @(
  @('Agarbatti Sandal 20 Sticks','Incense sticks',$pk,30),
  @('Dhoop Cones 20pc','Dhoop cones',$pk,40),
  @('Camphor Tablets 50g','Kapoor',$pk,50),
  @('Cotton Wicks Pack','Diya wicks',$pk,20),
  @('Ghee Diya Oil 100ml','Puja ghee',$pk,60),
  @('Kumkum Pack 25g','Kumkum',$pk,25),
  @('Turmeric Puja 25g','Haldi puja',$pk,20),
  @('Rudraksha Mala','Prayer beads',$pc,150),
  @('Brass Diya Small','Oil lamp',$pc,120),
  @('Puja Thali Set','Thali set',$pk,250),
  @('Flower Garland Artificial','Decoration mala',$pc,40),
  @('Holy Water Bottle 100ml','Gangajal',$pk,30),
  @('Betel Nut Supari Puja','Puja supari',$pk,35),
  @('Match Box Pack 10','Safety matches',$pk,20),
  @('Kalash Small Copper','Puja kalash',$pc,180)
)

Add-Cat $catalog 38 @(
  @('Notebook Ruled 200 Pages','Classmate style',$pc,60),
  @('Ball Pen Pack 5pc','Blue pens',$pk,40),
  @('Pencil HB Pack 10pc','HB pencils',$pk,50),
  @('Eraser Sharpener Combo','Study combo',$pk,30),
  @('Geometry Box','Math set',$pk,120),
  @('A4 Paper Ream 100 Sheets','Printing paper',$pk,180),
  @('Glue Stick 15g','Paper glue',$pc,25),
  @('Colour Pencil 12pc','Colour set',$pk,80),
  @('Crayon Pack 12pc','Wax crayons',$pk,50),
  @('Sticky Notes Pack','Memo notes',$pk,40),
  @('Toy Car Diecast','Pull back car',$pc,150),
  @('Building Blocks 50pc','Blocks set',$pk,299),
  @('Soft Toy Bear Small','Plush toy',$pc,250),
  @('Playing Cards Pack','Card deck',$pk,60),
  @('Sketch Pen Set 12pc','Sketch pens',$pk,70)
)

Add-Cat $catalog 39 @(
  @('Cotton Socks 3 Pair','Ankle socks',$pk,120),
  @('Handkerchief Pack 3','Cotton hankies',$pk,90),
  @('Cap Sports Adjustable','Baseball cap',$pc,199),
  @('Belt Leatherette','Casual belt',$pc,299),
  @('Hair Band Pack 6pc','Hair bands',$pk,60),
  @('Sunglasses UV','UV sunglasses',$pc,399),
  @('Wallet Bifold','Card wallet',$pc,350),
  @('Scarf Cotton','Cotton scarf',$pc,250),
  @('Slippers Rubber Size 8','Home slippers',$pc,180),
  @('T-Shirt Basic M','Cotton tee',$pc,399),
  @('Dupatta Plain','Light dupatta',$pc,299),
  @('Watch Strap Silicone','Watch band',$pc,150),
  @('Earrings Stud Pair','Fashion studs',$pk,120),
  @('Necklace Chain Simple','Fashion chain',$pc,199),
  @('Rain Poncho Disposable','Emergency poncho',$pc,80)
)

Add-Cat $catalog 40 @(
  @('Yoga Mat 6mm','Exercise mat',$pc,499),
  @('Skipping Rope','Jump rope',$pc,150),
  @('Dumbbell 2kg Pair','Home weights',$pk,600),
  @('Resistance Band Set','Exercise bands',$pk,350),
  @('Water Bottle Sports 750ml','Gym bottle',$pc,250),
  @('Gym Gloves','Workout gloves',$pk,299),
  @('Cricket Tennis Ball','Tennis ball',$pc,40),
  @('Badminton Shuttle 3pc','Nylon shuttle',$pk,120),
  @('Football Size 5','Training football',$pc,499),
  @('Sports Wristband 2pc','Sweat bands',$pk,80),
  @('Knee Cap Pair','Support knee',$pk,250),
  @('Push Up Bars','Push-up stands',$pk,400),
  @('Foam Roller Mini','Muscle roller',$pc,350),
  @('Sports Towel','Gym towel',$pc,180),
  @('Agility Ladder','Speed ladder',$pc,450)
)

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('-- Seed ~15 relevant master items for each Instamart-style category (V9/V10).')
[void]$sb.AppendLine('-- Vendors can pick these in catalog picker and publish listings.')
[void]$sb.AppendLine('-- Idempotent on master_items.id.')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('INSERT INTO master_items (id, category_id, name, description, unit_id, mrp)')
[void]$sb.AppendLine('SELECT v.id, v.category_id, v.name, v.description, v.unit_id, v.mrp')
[void]$sb.AppendLine('FROM (VALUES')

$rows = New-Object System.Collections.Generic.List[string]
foreach ($cat in ($catalog.Keys | Sort-Object)) {
  $catId = CatUuid $cat
  $items = $catalog[$cat]
  for ($i = 1; $i -le 15; $i++) {
    $it = $items[$i - 1]
    $id = Mid $cat $i
    if ($id.Length -ne 36) { throw "Bad UUID $id len $($id.Length) cat=$cat item=$i" }
    $name = ([string]$it[0]).Replace("'", "''")
    $desc = ([string]$it[1]).Replace("'", "''")
    $unit = [string]$it[2]
    $mrp = '{0:0.00}' -f [double]$it[3]
    $rows.Add("    ('$id'::uuid, '$catId'::uuid, '$name', '$desc', '$unit'::uuid, $mrp)")
  }
}

[void]$sb.AppendLine(($rows -join ",`r`n"))
[void]$sb.AppendLine(') AS v(id, category_id, name, description, unit_id, mrp)')
[void]$sb.AppendLine('WHERE NOT EXISTS (SELECT 1 FROM master_items m WHERE m.id = v.id)')
[void]$sb.AppendLine('  AND EXISTS (SELECT 1 FROM categories c WHERE c.id = v.category_id);')

$abs = [System.IO.Path]::GetFullPath($out)
[System.IO.File]::WriteAllText($abs, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $abs with $($rows.Count) items across $($catalog.Count) categories"
