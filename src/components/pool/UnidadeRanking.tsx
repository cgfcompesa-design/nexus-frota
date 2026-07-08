import {
    Building2,
    Ticket,
    Car,
    DollarSign
} from "lucide-react";

interface Unidade {

    unidade: string;

    vouchers: number;

    custo: number;

    km: number;

}

interface Props {

    dados: Unidade[];

}

export default function UnidadeRanking({

    dados

}: Props) {

    return (

        <div className="bg-white rounded-xl border shadow-sm">

            <div className="flex items-center gap-2 p-5 border-b">

                <Building2 className="text-blue-600" />

                <h2 className="font-semibold text-lg">

                    Ranking de Unidades

                </h2>

            </div>

            <div className="overflow-auto">

                <table className="min-w-full">

                    <thead className="bg-gray-50">

                        <tr>

                            <th className="text-left px-4 py-3">

                                Unidade

                            </th>

                            <th className="text-center px-4 py-3">

                                <div className="flex justify-center">

                                    <Ticket size={18} />

                                </div>

                            </th>

                            <th className="text-center px-4 py-3">

                                <div className="flex justify-center">

                                    <Car size={18} />

                                </div>

                            </th>

                            <th className="text-right px-4 py-3">

                                <div className="flex justify-end">

                                    <DollarSign size={18} />

                                </div>

                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        {

                            dados.map((item, index) => (

                                <tr
                                    key={item.unidade}
                                    className="border-t hover:bg-gray-50 transition-colors"
                                >

                                    <td className="px-4 py-3">

                                        <div className="flex items-center gap-3">

                                            <div
                                                className="
                                                w-8
                                                h-8
                                                rounded-full
                                                bg-blue-600
                                                text-white
                                                flex
                                                items-center
                                                justify-center
                                                font-semibold
                                            "
                                            >

                                                {index + 1}

                                            </div>

                                            <span>

                                                {item.unidade}

                                            </span>

                                        </div>

                                    </td>

                                    <td className="text-center">

                                        {item.vouchers}

                                    </td>

                                    <td className="text-center">

                                        {item.km.toLocaleString("pt-BR")}

                                    </td>

                                    <td className="text-right px-4">

                                        {item.custo.toLocaleString(

                                            "pt-BR",

                                            {

                                                style: "currency",

                                                currency: "BRL"

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

    );

}
