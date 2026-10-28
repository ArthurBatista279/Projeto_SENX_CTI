using System;
using System.Collections.Generic;

namespace SenxCti.Api.Models;

public partial class Assunto
{
    public Guid IdAssunto { get; set; }

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Nome { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Descricao { get; set; } = null!;

    [System.ComponentModel.DataAnnotations.MaxLength(255)]
    public string Categoria { get; set; } = null!;

    [System.Text.Json.Serialization.JsonIgnore]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public virtual ICollection<Ligacao> IdLigacao { get; set; } = new List<Ligacao>();
}
