using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Assunto
{
    public Guid IdAssunto { get; set; }

    public string Nome { get; set; } = null!;

    public string Descricao { get; set; } = null!;

    public string Categoria { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Ligacao> IdLigacao { get; set; } = new List<Ligacao>();
}
