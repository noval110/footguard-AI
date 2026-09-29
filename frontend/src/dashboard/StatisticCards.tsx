const data=[
{
title:"Total Pemeriksaan",
value:"5"
},
{
title:"Temuan AI",
value:"2"
},
{
title:"Konsultasi Dokter",
value:"1"
},
{
title:"Artikel Edukasi",
value:"12"
}
]


export default function StatisticCards(){


return(

<div
className="
grid
grid-cols-4
gap-5
">


{
data.map(item=>(

<div
key={item.title}
className="
bg-white
rounded-2xl
p-6
shadow-sm
">


<p className="
text-gray-500
text-sm
">

{item.title}

</p>


<h2
className="
text-4xl
font-semibold
mt-3
">

{item.value}

</h2>


</div>


))

}


</div>


)


}