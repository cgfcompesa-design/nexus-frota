import { DollarSign } from "lucide-react";

interface Item{

    placa:string;

    custo:number;

}

interface Props{

    dados:Item[];

}

export default function TopCusto({

    dados

}:Props){

    const maior=Math.max(

        ...dados.map(x=>x.custo),

        1

    );

    return(

        <div className="bg-white rounded-xl border shadow-sm">

            <div className="flex items-center gap-2 p-5 border-b">

                <DollarSign className="text-red-600"/>

                <h2 className="font-semibold text-lg">

                    Top 10 Custo Operacional

                </h2>

            </div>

            <div className="p-5 space-y-4">

                {

                    dados.map((item,index)=>{

                        const percentual=(item.custo/maior)*100;

                        return(

                            <div key={item.placa}>

                                <div className="flex justify-between mb-1">

                                    <div className="flex gap-3">

                                        <span className="font-semibold text-gray-500">

                                            #{index+1}

                                        </span>

                                        <span>

                                            {item.placa}

                                        </span>

                                    </div>

                                    <span className="font-semibold">

                                        {item.custo.toLocaleString(

                                            "pt-BR",

                                            {

                                                style:"currency",

                                                currency:"BRL"

                                            }

                                        )}

                                    </span>

                                </div>

                                <div className="bg-gray-200 rounded-full h-3">

                                    <div

                                        className="bg-red-600 rounded-full h-3 transition-all"

                                        style={{

                                            width:`${percentual}%`

                                        }}

                                    />

                                </div>

                            </div>

                        )

                    })

                }

            </div>

        </div>

    )

}
