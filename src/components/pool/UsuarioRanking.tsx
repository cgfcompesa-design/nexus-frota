import { User, Ticket, DollarSign, Percent } from "lucide-react";

interface UsuarioRankingItem {
    usuario: string;
    quantidade: number;
    custo: number;
}

interface Props {
    dados: UsuarioRankingItem[];
}

export default function UsuarioRanking({ dados }: Props) {

    const totalSolicitacoes = dados.reduce(
        (s, item) => s + item.quantidade,
        0
    );

    return (

        <div className="bg-white rounded-xl border shadow-sm">

            <div className="flex items-center gap-2 p-5 border-b">

                <User className="text-blue-600" />

                <h2 className="text-lg font-semibold">

                    Ranking de Usuários

                </h2>

            </div>

            <div className="overflow-auto">

                <table className="min-w-full">

                    <thead className="bg-gray-50">

                        <tr>

                            <th className="text-left px-4 py-3">

                                Usuário

                            </th>

                            <th className="text-center px-4 py-3">

                                <div className="flex justify-center">

                                    <Ticket size={18} />

                                </div>

                            </th>

                            <th className="text-right px-4 py-3">

                                <div className="flex justify-end">

                                    <DollarSign size={18} />

                                </div>

                            </th>

                            <th className="text-right px-4 py-3">

                                Ticket Médio

                            </th>

                            <th className="text-center px-4 py-3">

                                <div className="flex justify-center">

                                    <Percent size={18} />

                                </div>

                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        {

                            dados.map((item, index) => {

                                const ticketMedio =
                                    item.quantidade === 0
                                        ? 0
                                        : item.custo / item.quantidade;

                                const percentual =
                                    totalSolicitacoes === 0
                                        ? 0
                                        : (item.quantidade /
                                              totalSolicitacoes) *
                                          100;

                                return (

                                    <tr
                                        key={item.usuario}
                                        className="border-t hover:bg-gray-50"
                                    >

                                        <td className="px-4 py-3">

                                            <div className="flex items-center gap-3">

                                                <div
                                                    className="
                                                        w-8
                                                        h-8
                                                        rounded-full
                                                        bg-indigo-600
                                                        text-white
                                                        flex
                                                        items-center
                                                        justify-center
                                                        font-semibold
                                                    "
                                                >

                                                    {index + 1}

                                                </div>

                                                {item.usuario}

                                            </div>

                                        </td>

                                        <td className="text-center">

                                            {item.quantidade}

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

                                        <td className="text-right px-4">

                                            {ticketMedio.toLocaleString(
                                                "pt-BR",
                                                {
                                                    style: "currency",
                                                    currency: "BRL"
                                                }
                                            )}

                                        </td>

                                        <td className="text-center">

                                            {percentual.toFixed(1)}%

                                        </td>

                                    </tr>

                                );

                            })

                        }

                    </tbody>

                </table>

            </div>

        </div>

    );

}
