import {
 BookOpen,
 ArrowRight
} from "lucide-react";


const articles=[
{
title:"Cara Merawat Kaki Diabetes",
category:"Pencegahan"
},
{
title:"Tanda Awal Luka Kaki",
category:"Deteksi"
},
{
title:"Pentingnya Pemeriksaan Rutin",
category:"Edukasi"
}
];


export default function EducationPanel(){

return(

<div
className="
bg-white
rounded-3xl
p-8
"
>


<div
className="
flex
justify-between
mb-6
"
>


<h2
className="
text-2xl
font-semibold
"
>

Edukasi Kesehatan

</h2>


<BookOpen/>

</div>



<div
className="
grid
grid-cols-3
gap-5
"
>


{
articles.map(article=>(


<div
key={article.title}
className="
border
border-gray-100
rounded-2xl
p-5
hover:shadow-md
transition
"
>


<p
className="
text-sm
text-[#063c38]
"
>

{article.category}

</p>


<h3
className="
font-semibold
mt-3
"
>

{article.title}

</h3>


<button
className="
flex
items-center
gap-2
mt-5
text-sm
"
>

Baca

<ArrowRight size={15}/>

</button>


</div>


))

}


</div>



</div>

)

}