import { Route } from "lucide-react";
import { PoolRecord } from "../../services/poolService";

interface Props{

    dados:PoolRecord[];

}

export default function CorridasRanking({

    dados

}:Props){

    return(

        <div className="bg-white rounded-xl border shadow-sm">

            <div className="flex items-center gap-2 p-5 border-b">

                <Route className="text-indigo-600"/>

                <h2 className="text-lg font-semibold">

                    Maiores Corridas

                </h2>

            </div>

            <div className="overflow-auto">

                <table className="min-w-full">

                    <thead className="bg-gray-50">

                        <tr>

                            <th className="text-left px-4 py-3">

                                Placa

                            </th>

                            <th className="text-left px-4 py-3">

                                Usuário

                            </th>

                            <th className="text-left px-4 py-3">

                                Unidade

                            </th>

                            <th className="text-right px-4 py-3">

                                KM

                            </th>

                            <th className="text-right px-4 py-3">

                                Valor

                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        {

                            dados.map((item,index)=>(

                                <tr
                                    key={index}
                                    className="border-t hover:bg-gray-50"
                                >

                                    <td className="px-4 py-3">

                                        {item.placa}

                                    </td>

                                    <td className="px-4">

                                        {item.usuario}

                                    </td>

                                    <td className="px-4">

                                        {item.unidade}

                                    </td>

                                    <td className="text-right px-4">

                                        {(item.km??0).toLocaleString("pt-BR")} km

                                    </td>

                                    <td className="text-right px-4">

                                        {(item.valor??0).toLocaleString(

                                            "pt-BR",

                                            {

                                                style:"currency",

                                                currency:"BRL"

                                            }

                                        )}

                                    </td>

                                </tr>

                            ))

                        }

                    </tbody>

                </table>

            </div>

        </div>

    )

}
